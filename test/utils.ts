import {
  clusterApiUrl,
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
} from '@solana/web3.js'

export const DEVNET = clusterApiUrl('devnet')
export const TESTNET = clusterApiUrl('testnet')
export const MAINNET_BETA = clusterApiUrl('mainnet-beta')
export const LOCALNET = 'http://127.0.0.1:8899'

export const isCI = process.env.CI != null

export async function createAccountIx(
  connection: Connection,
  fromPubkey: PublicKey,
  newAccountPubkey: PublicKey,
  space = 1
) {
  return SystemProgram.createAccount({
    programId: SystemProgram.programId,
    space,
    lamports: await connection.getMinimumBalanceForRentExemption(space),
    fromPubkey,
    newAccountPubkey,
  })
}

export async function createAccountTx(
  connection: Connection,
  fromKeypair: Keypair,
  newAccountKeypair: Keypair,
  space = 1
) {
  const ix = await createAccountIx(
    connection,
    fromKeypair.publicKey,
    newAccountKeypair.publicKey,
    space
  )
  const tx = new Transaction({
    feePayer: fromKeypair.publicKey,
  }).add(ix)
  return tx
}

export async function createAccount(
  connection: Connection,
  fromKeypair: Keypair,
  newAccountKeypair: Keypair,
  space = 1
) {
  const tx = await createAccountTx(
    connection,
    fromKeypair,
    newAccountKeypair,
    space
  )
  return sendAndConfirmTransaction(connection, tx, [
    fromKeypair,
    newAccountKeypair,
  ])
}
