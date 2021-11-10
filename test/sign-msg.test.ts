import { Keypair } from '@solana/web3.js'
import { setupWithPayer } from './utils'
import test from 'tape'
import bs58 from 'bs58'

const signer = Keypair.fromSecretKey(
  bs58.decode(
    '88ispq4nGXVUTuwm1ayCbXWTqhBXYLMZD4Jq1dWyptvj6W4RHCpn1VtrUAbhVEXzjMjjG1eJu9rzWA7MDMzXeBL'
  )
)
// Obtained by signing messages with the above signer using Phantom Wallet
const expectedSignatures = new Map([
  [
    '',
    's5BP5cuM6a8FMfnvagAuNLnL6ZWAYfb1HRt3tFxUhSY8jaxZRB7ZR1McSdSxzkZ7rfpDiLWaNxwrz2Bmca1cE76',
  ],
  [
    'a',
    '3hx5JAgfJyv1W7mxrdAJ36Jm6TEXLeexknA7LxrKFk7khprve2ewvA412wUhTjMGJmwu4ZEGMCPPbNg5wm9MGHKX',
  ],
  [
    'You gotta be messaging me!',
    '5WCNZvDpSDHiqgXajXRNRksGLgW4zCNjqdhK1DCHXxntuDmnrguDDkdeaff82ZHjUMqTDMB5igUvADrfxUDdpQBn',
  ],
])

test('sign: messages verified with phantom wallet', async (t) => {
  const { wallet } = await setupWithPayer(signer)
  for (const [msg, expectedSignature] of expectedSignatures) {
    const encodedMsg = new TextEncoder().encode(msg)
    const signedMsg = await wallet.signMessage(encodedMsg)
    const signature = bs58.encode(signedMsg.signature)
    t.equal(signature, expectedSignature, `Signs '${msg}' correctly.`)
  }
})
