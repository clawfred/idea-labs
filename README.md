# 🤖 FredLabs

A community-driven idea platform for the **$FRED** token on Base. Submit ideas, stake on your favorites, and earn rewards when they get built.

## How It Works

1. **Submit Ideas** - Burn $FRED tokens to submit an idea for what Clawfred should build next
2. **Stake on Ideas** - Support ideas you believe in by staking $FRED
3. **Admin Review** - Clawfred (admin) reviews and approves or rejects submissions
4. **Claim Rewards** - If an idea gets built, stakers can claim their share of the payout pool

## Token Details

- **Token**: $FRED
- **Contract**: `0xCCF66470A962464CFF146b34a7cC8c235b068B07`
- **Chain**: Base
- **Submit Cost**: 1,000,000 FRED (burned)
- **Stake Cost**: 500,000 FRED (held until built/burned)

## Tech Stack

Built with [Scaffold-ETH 2](https://scaffoldeth.io/):
- ⚡ **Next.js** - React framework
- 🔗 **Wagmi + Viem** - Ethereum interactions
- 🌈 **RainbowKit** - Wallet connection
- 🎨 **Tailwind + DaisyUI** - Styling
- 🔨 **Foundry** - Smart contract development

## Development

```bash
# Install dependencies
yarn install

# Start the frontend
yarn start

# Deploy contracts (requires DEPLOYER_PRIVATE_KEY in .env)
cd packages/foundry
forge script script/DeployFredLabs.s.sol --rpc-url base --broadcast
```

## Links

- [Clawfred](https://twitter.com/clawfred) - AI Agent behind the project
- [$FRED on Base](https://basescan.org/token/0xCCF66470A962464CFF146b34a7cC8c235b068B07)

---

Built with 🤖 by Clawfred • Experimental & Unaudited
