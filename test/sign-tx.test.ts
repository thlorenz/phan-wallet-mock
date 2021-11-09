import {
  Keypair,
  LAMPORTS_PER_SOL,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  TransactionSignature,
} from '@solana/web3.js'
import { createWalletMock } from '../src/phan-wallet-mock'
import { createAccount, LOCALNET } from './utils'
import spok from 'spok'
import test from 'tape'
import * as util from 'util'

function inspect(x: any) {
  return util.inspect(x, { depth: 5 })
}

// @ts-ignore used once in a while
function dump(x: any) {
  console.log(inspect(x))
}

function isBuffer(x: any): x is Buffer {
  return Buffer.isBuffer(x)
}

function trimTransferIx(
  ix: TransactionInstruction
): Partial<TransactionInstruction> {
  return {
    keys: ix.keys,
  }
}

async function setup(net = LOCALNET) {
  const payer = Keypair.generate()
  const wallet = createWalletMock(net, payer, 'confirmed')

  await wallet.connect()
  const signature = await wallet.connection.requestAirdrop(
    payer.publicKey,
    LAMPORTS_PER_SOL * 5
  )
  await wallet.connection.confirmTransaction(signature)

  return { payer, wallet }
}

test('sign: empty transaction', async (t) => {
  try {
    const { wallet, payer } = await setup()
    const publicKey = payer.publicKey
    const tx = new Transaction()
    const signedTx = await wallet.signTransaction(tx)
    spok(t, signedTx, {
      signatures: [{ signature: isBuffer, publicKey }],
      instructions: [],
    })
  } catch (err: any) {
    t.fail(err)
  }
})

test('sign: transaction with one transfer instruction', async (t) => {
  try {
    const { wallet, payer } = await setup()
    const publicKey = payer.publicKey
    let sig: TransactionSignature

    // -----------------
    // Create Receiver Account
    // -----------------
    const receiver = Keypair.generate()
    sig = await createAccount(wallet.connection, payer, receiver)
    t.comment(`+++ Created account, signature: ${sig} +++`)

    // -----------------
    // Create Transfer Ix and Tx
    // -----------------
    const transferIx = SystemProgram.transfer({
      lamports: 10,
      fromPubkey: publicKey,
      toPubkey: receiver.publicKey,
    })
    const transferTx = new Transaction().add(transferIx)

    // -----------------
    // Sign Transfer Tx
    // -----------------
    const signedTransferTx = await wallet.signTransaction(transferTx)
    spok(t, signedTransferTx, {
      $topic: 'tx:signed',
      signatures: [{ signature: isBuffer, publicKey }],
      feePayer: spok.notDefined,
      instructions: [trimTransferIx(transferIx)],
      recentBlockhash: spok.string,
      nonceInfo: spok.notDefined,
    })

    // -----------------
    // Send and Confirm Transfer Tx
    // -----------------
    sig = await wallet.connection.sendRawTransaction(
      signedTransferTx.serialize()
    )
    spok(t, { sig }, { $topic: 'tx:ssent', sig: spok.string })

    const res = await wallet.connection.confirmTransaction(sig)
    spok(t, res, {
      $topic: 'tx:confirmed',
      context: { slot: spok.gtz },
      value: { err: spok.notDefined },
    })
  } catch (err: any) {
    t.fail(err)
  }
})
