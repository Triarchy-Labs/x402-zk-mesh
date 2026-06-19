# X402 ZK Mesh — Stellar Testnet Deployment Log

## Deployer Account
- **Address**: `GCKCI5MTMGE2DQT4IIRKDVXWKUP5HFDOLFGM25RIV6HNP2YCA7RADUPY`
- **Network**: Stellar Testnet (Protocol 27)
- **CLI**: stellar 27.0.0
- **SDK**: soroban-sdk 27.0.0-rc.1
- **Target**: wasm32v1-none (Rust 1.95)

## Deployed Contracts

| Contract | Contract ID | Explorer |
|----------|------------|---------|
| **zk-verifier** | `CDSOEVAUKQQBRJ4GQVH4XZM2CARDONRPD2X2B6IZDXSVP33PUYYKSCQL` | [View](https://stellar.expert/explorer/testnet/contract/CDSOEVAUKQQBRJ4GQVH4XZM2CARDONRPD2X2B6IZDXSVP33PUYYKSCQL) |
| **privacy-pool** | `CDGTAPVSKG5EWJIJUCGDHFXJ5YWDKEOAICVFBFLZ7QPAX5HII2IBB74X` | [View](https://stellar.expert/explorer/testnet/contract/CDGTAPVSKG5EWJIJUCGDHFXJ5YWDKEOAICVFBFLZ7QPAX5HII2IBB74X) |
| **guild-registry** | `CBH5UVNM6P4JMNRQ5NH4QNMOIZGWA4KQW2DI4G5EKJ5CZ3RXQSK7CGLG` | [View](https://stellar.expert/explorer/testnet/contract/CBH5UVNM6P4JMNRQ5NH4QNMOIZGWA4KQW2DI4G5EKJ5CZ3RXQSK7CGLG) |

## Initialization Transactions

| Contract | Function | TX Hash |
|----------|----------|---------|
| zk-verifier | `init(vk)` — deposit_commitment VK loaded | [bc540428...](https://stellar.expert/explorer/testnet/tx/bc540428751b8aaeabc835c8d0b3ab17c5882b5f8a9d29f3497d70b51d77d4b9) |
| privacy-pool | `init(depth=20)` — supports ~1M deposits | [7f339e0e...](https://stellar.expert/explorer/testnet/tx/7f339e0e000d31d7566f842d78d46e5dec334c043c10767a4bf0bc75da273a30) |
| guild-registry | `init(admin, root, 3)` — 3 initial members | [33992197...](https://stellar.expert/explorer/testnet/tx/33992197bae0d10fce67c242b65c1313f1b91c8ba3710360acf78ecf5d8f74ab) |

## WASM Hashes

| Contract | WASM Hash |
|----------|-----------|
| zk-verifier | `09c4b5656a53902076321e819c87cef0ffad02bdbf45ea383db50457a8593c9d` |
| privacy-pool | `5999348fdcf38a97bdd9428eaad845b3f180d32186f80f83969e5761426e6f86` |
| guild-registry | `2e2a1b32e471a4e6bc97ccaa85331ed4950db1327b315769b8329d98c5e7e0ec` |

## Deploy Transactions

| Contract | TX Hash | Link |
|----------|---------|------|
| zk-verifier | `a4f359d6...` | [Explorer](https://stellar.expert/explorer/testnet/tx/a4f359d6770106984b680c81dabb6e2ccd71b3ceeffb2e28def3bd1789258d2f) |
| privacy-pool | `ca9141f5...` | [Explorer](https://stellar.expert/explorer/testnet/tx/ca9141f51272e11ef0971feb9b8ceafc244abed79b0343ffc3c3bd7f2c820bef) |
| guild-registry | `0355fc2b...` | [Explorer](https://stellar.expert/explorer/testnet/tx/0355fc2bfea63cc0df0c3eff477c4481eaa355726eab28d8c8fac4f593c7dfae) |
