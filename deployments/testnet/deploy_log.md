# X402 ZK Mesh — Stellar Testnet Deployment Log

## Deployer Account
- **Address**: `GCKCI5MTMGE2DQT4IIRKDVXWKUP5HFDOLFGM25RIV6HNP2YCA7RADUPY`
- **Network**: Stellar Testnet (Test SDF Network; September 2015)
- **CLI**: stellar 22.6.0

## WASM Code Upload (on-chain)

| Contract | WASM Hash | Status |
|----------|-----------|--------|
| zk-verifier | `a721bc9a92e117c5b5a2b2eed8c0a819c9969997e2057231b224fa91b193bc98` | ✅ Uploaded |
| privacy-pool | `05ebf8e4b7a0012a78efbe21c1b0b3a80cb901cb53899604fb3f49789afe2f86` | ✅ Uploaded |
| guild-registry | `48873d81c4871aaca63f96e3a8a765876a0205261732934087fcffc3fdee028f` | ✅ Uploaded |

## Contract Instances

| Contract | Contract ID | Status |
|----------|------------|--------|
| zk-verifier | — | ⚠️ Deploy TX fails with XDR bug in stellar-cli v22.6.0 |
| privacy-pool | — | ⚠️ Same XDR bug |
| guild-registry | — | ⚠️ Same XDR bug |

## Known Issue
`stellar contract deploy` fails with `xdr processing error: xdr value invalid` when signing deploy transactions. This is a known bug in stellar-cli v22.6.0 affecting transaction envelope signing. WASM code is successfully uploaded to the network but contract instance creation fails at the signing step.

**Workaround**: Use stellar-cli v21.x or wait for v22.7+ fix.
