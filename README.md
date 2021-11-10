# phan-wallet-mock [![Build and Test](https://github.com/thlorenz/phan-wallet-mock/actions/workflows/build-and-test.yml/badge.svg)](https://github.com/thlorenz/phan-wallet-mock/actions/workflows/build-and-test.yml)

Mock version of Phantom Wallet. **ONLY USE FOR TESTING!!!**

```ts
export async function setupWithPayer(
  payer = Keypair.generate(),
  net = LOCALNET
): Promise<{ payer: Keypair; wallet: PhantomWalletMock }> {
  const wallet = PhantomWalletMock.create(net, payer, 'confirmed')

  // NOTE: no user approval needed
  await wallet.connect()
  const signature = await wallet.connection.requestAirdrop(
    payer.publicKey,
    LAMPORTS_PER_SOL * 5
  )
  // NOTE: no user approval needed here either
  await wallet.connection.confirmTransaction(signature)

  return { payer, wallet }
}

const { wallet, payer } = await setupWithPayer()

// NOTE: this only works when no actual Phantom extension is present as then `window.solana`
// cannot be overwritten
window.solana = wallet
```

[API documentation](https://thlorenz.github.io/phan-wallet-mock/docs/index.html)

## How it Works

Unlike with real wallets `phan-wallet-mock` requires the user to provide a full `Keypair` which
it uses under the hood to sign transactions and messages.

To do that it never requires the user's approval like the original does in order to ease
testing.

**THEREFORE MAKE SURE TO ONLY USE THIS WHILE RUNNING TESTS WITH FRESHLY GENERATED KEYPAIRS!!!**

## LICENSE

MIT
