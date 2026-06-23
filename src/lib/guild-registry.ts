import { createHash, randomBytes, randomUUID } from "node:crypto";
import * as fs from "node:fs";
import path from "node:path";
// @ts-expect-error circomlibjs does not publish TypeScript declarations.
import { buildPoseidon } from "circomlibjs";
import { fieldDecimalToBytes32Hex } from "./soroban-guild-registry";

const BN254_FIELD =
  BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");
export const MEMBERSHIP_TREE_LEVELS = 10;
export const ZERO_MEMBERSHIP_PATH = Array.from(
  { length: MEMBERSHIP_TREE_LEVELS },
  () => "0"
);
export const ZERO_MEMBERSHIP_INDICES = Array.from(
  { length: MEMBERSHIP_TREE_LEVELS },
  () => 0
);

interface Poseidon {
  (inputs: Array<string | bigint | number>): unknown;
  F: {
    toObject(value: unknown): bigint | string | number;
  };
}

export interface GuildMember {
  id: string;
  name: string;
  capabilities: string[];
  publicKey?: string;
  membershipLeaf: string;
  membershipRoot: string;
  membershipRootBytes32: string;
  registeredAt: string;
  status: "active";
}

interface RegisterAgentInput {
  name: string;
  capabilities: string[];
  publicKey?: string;
}

interface PersistedGuildRegistry {
  version: 1;
  updatedAt: string;
  members: GuildMember[];
  approvedRoots: string[];
}

let poseidonPromise: Promise<Poseidon> | null = null;

const guildMembers: GuildMember[] = [];
const approvedRoots = new Set<string>();
let registryLoaded = false;

export async function registerGuildAgent(input: RegisterAgentInput): Promise<GuildMember> {
  ensureGuildRegistryLoaded();

  const nonce = randomBytes(16).toString("hex");
  const identity = `${input.name}:${input.publicKey || "anon"}:${nonce}`;
  const membershipLeaf = fieldScalarFromHash(identity);
  const membershipRoot = await computeZeroPathRoot(membershipLeaf);

  const member: GuildMember = {
    id: randomUUID(),
    name: input.name,
    capabilities: input.capabilities,
    publicKey: input.publicKey,
    membershipLeaf,
    membershipRoot,
    membershipRootBytes32: fieldDecimalToBytes32Hex(membershipRoot),
    registeredAt: new Date().toISOString(),
    status: "active",
  };

  guildMembers.push(member);
  approvedRoots.add(normalizeField(member.membershipRoot));
  persistGuildRegistry();

  return member;
}

export function getGuildMembers(): GuildMember[] {
  ensureGuildRegistryLoaded();
  return guildMembers.map((member) => ({ ...member }));
}

export function isApprovedGuildRoot(root: string): boolean {
  ensureGuildRegistryLoaded();
  return approvedRoots.has(normalizeField(root));
}

export function getApprovedGuildRoots(): string[] {
  ensureGuildRegistryLoaded();
  return Array.from(approvedRoots);
}

export function reloadGuildRegistryFromDiskForTests(): void {
  guildMembers.length = 0;
  approvedRoots.clear();
  registryLoaded = false;
  ensureGuildRegistryLoaded();
}

export function getMembershipProofInputs(member: GuildMember): {
  leaf: string;
  pathElements: string[];
  pathIndices: number[];
  root: string;
} {
  return {
    leaf: member.membershipLeaf,
    pathElements: [...ZERO_MEMBERSHIP_PATH],
    pathIndices: [...ZERO_MEMBERSHIP_INDICES],
    root: member.membershipRoot,
  };
}

export function fieldScalarFromHash(value: string): string {
  const hash = createHash("sha256").update(value).digest("hex");
  return (BigInt(`0x${hash}`) % BN254_FIELD).toString();
}

export async function computeZeroPathRoot(leaf: string): Promise<string> {
  let current = normalizeField(leaf);

  for (let i = 0; i < MEMBERSHIP_TREE_LEVELS; i += 1) {
    current = await poseidon2(current, "0");
  }

  return current;
}

function normalizeField(value: string): string {
  return (BigInt(value) % BN254_FIELD).toString();
}

function registryStorePath(): string {
  return process.env.GUILD_REGISTRY_STORE_PATH
    ? path.resolve(process.env.GUILD_REGISTRY_STORE_PATH)
    : path.join(process.cwd(), "guild-data", "guild-registry.json");
}

function ensureGuildRegistryLoaded(): void {
  if (registryLoaded) {
    return;
  }

  registryLoaded = true;
  const storePath = registryStorePath();
  if (!fs.existsSync(storePath)) {
    return;
  }

  try {
    const raw = fs.readFileSync(storePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<PersistedGuildRegistry>;
    const members = Array.isArray(parsed.members) ? parsed.members : [];
    const roots = Array.isArray(parsed.approvedRoots) ? parsed.approvedRoots : [];

    guildMembers.length = 0;
    guildMembers.push(...members.filter(isPersistedGuildMember));
    approvedRoots.clear();
    for (const root of roots) {
      if (typeof root === "string") {
        approvedRoots.add(normalizeField(root));
      }
    }
    for (const member of guildMembers) {
      approvedRoots.add(normalizeField(member.membershipRoot));
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[GUILD_REGISTRY] Failed to load persisted registry: ${message}`);
  }
}

function persistGuildRegistry(): void {
  const storePath = registryStorePath();
  const payload: PersistedGuildRegistry = {
    version: 1,
    updatedAt: new Date().toISOString(),
    members: guildMembers,
    approvedRoots: Array.from(approvedRoots),
  };

  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  const tmpPath = `${storePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(payload, null, 2));
  fs.renameSync(tmpPath, storePath);
}

function isPersistedGuildMember(value: unknown): value is GuildMember {
  if (!value || typeof value !== "object") {
    return false;
  }
  const member = value as Partial<GuildMember>;
  return (
    typeof member.id === "string" &&
    typeof member.name === "string" &&
    Array.isArray(member.capabilities) &&
    typeof member.membershipLeaf === "string" &&
    typeof member.membershipRoot === "string" &&
    typeof member.membershipRootBytes32 === "string" &&
    typeof member.registeredAt === "string" &&
    member.status === "active"
  );
}

async function poseidon2(left: string, right: string): Promise<string> {
  const poseidon = await getPoseidon();
  return poseidon.F.toObject(poseidon([left, right])).toString();
}

async function getPoseidon(): Promise<Poseidon> {
  const promise: Promise<Poseidon> = poseidonPromise || buildPoseidon();
  poseidonPromise = promise;

  return promise;
}
