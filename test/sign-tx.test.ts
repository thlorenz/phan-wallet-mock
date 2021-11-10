import {
  Keypair,
  RpcResponseAndContext,
  SignatureResult,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  TransactionSignature,
} from '@solana/web3.js'
import { createAccount, isBuffer, setupWithPayer } from './utils'
import spok from 'spok'
import test from 'tape'

function trimTransferIx(
  ix: TransactionInstruction
): Partial<TransactionInstruction> {
  return {
    keys: ix.keys,
  }
}

test('sign: empty transaction', async (t) => {
  try {
    const { wallet, payer } = await setupWithPayer()
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
    const { wallet, payer } = await setupWithPayer()
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

test('sign: multiple transactions with one transfer instruction each', async (t) => {
  try {
    const { wallet, payer } = await setupWithPayer()
    const publicKey = payer.publicKey
    let sig: TransactionSignature
    let res: RpcResponseAndContext<SignatureResult>

    // -----------------
    // Create Receiver Account
    // -----------------
    const receiver = Keypair.generate()
    sig = await createAccount(wallet.connection, payer, receiver)
    t.comment(`+++ Created account, signature: ${sig} +++`)

    // -----------------
    // Create Transfer Ix and Tx
    // -----------------
    const transferTxUno = new Transaction().add(
      SystemProgram.transfer({
        lamports: 10,
        fromPubkey: publicKey,
        toPubkey: receiver.publicKey,
      })
    )

    const transferTxDos = new Transaction().add(
      SystemProgram.transfer({
        lamports: 11,
        fromPubkey: publicKey,
        toPubkey: receiver.publicKey,
      })
    )

    // -----------------
    // Sign Transfer Txs
    // -----------------
    const [signedTransferTxUno, signedTransferTxDos] =
      await wallet.signAllTransactions([transferTxUno, transferTxDos])

    spok(t, signedTransferTxUno, {
      $topic: 'txuno:signed',
      signatures: [{ signature: isBuffer, publicKey }],
      feePayer: spok.notDefined,
      instructions: [
        trimTransferIx(
          SystemProgram.transfer({
            lamports: 10,
            fromPubkey: publicKey,
            toPubkey: receiver.publicKey,
          })
        ),
      ],
      recentBlockhash: spok.string,
      nonceInfo: spok.notDefined,
    })
    spok(t, signedTransferTxUno, {
      $topic: 'txdos:signed',
      signatures: [{ signature: isBuffer, publicKey }],
      feePayer: spok.notDefined,
      instructions: [
        trimTransferIx(
          SystemProgram.transfer({
            lamports: 10,
            fromPubkey: publicKey,
            toPubkey: receiver.publicKey,
          })
        ),
      ],
      recentBlockhash: spok.string,
      nonceInfo: spok.notDefined,
    })

    // -----------------
    // Send and Confirm Transfer Tx
    // -----------------
    sig = await wallet.connection.sendRawTransaction(
      signedTransferTxUno.serialize()
    )
    spok(t, { sig }, { $topic: 'txuno:ssent', sig: spok.string })

    res = await wallet.connection.confirmTransaction(sig)
    spok(t, res, {
      $topic: 'txuno:confirmed',
      context: { slot: spok.gtz },
      value: { err: spok.notDefined },
    })

    sig = await wallet.connection.sendRawTransaction(
      signedTransferTxDos.serialize()
    )
    spok(t, { sig }, { $topic: 'txdos:ssent', sig: spok.string })

    res = await wallet.connection.confirmTransaction(sig)
    spok(t, res, {
      $topic: 'txdos:confirmed',
      context: { slot: spok.gtz },
      value: { err: spok.notDefined },
    })
  } catch (err: any) {
    t.fail(err)
  }
})
