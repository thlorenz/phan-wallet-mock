import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
} from '@solana/web3.js'
import { LOCALNET, PhantomWalletMock } from '../src/phan-wallet-mock'
import * as util from 'util'

export const isCI = process.env.CI != null

export function inspect(x: any) {
  return util.inspect(x, { depth: 5 })
}

export function dump(x: any) {
  console.log(inspect(x))
}

export function isBuffer(x: any): x is Buffer {
  return Buffer.isBuffer(x)
}

export async function setupWithPayer(
  payer = Keypair.generate(),
  net = LOCALNET
): Promise<{ payer: Keypair; wallet: PhantomWalletMock }> {
  const wallet = PhantomWalletMock.create(net, payer, 'confirmed')

  await wallet.connect()
  const signature = await wallet.connection.requestAirdrop(
    payer.publicKey,
    LAMPORTS_PER_SOL * 5
  )
  await wallet.connection.confirmTransaction(signature)

  return { payer, wallet }
}
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
