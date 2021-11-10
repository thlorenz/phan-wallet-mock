import { Keypair, Transaction } from '@solana/web3.js'
import { PhantomWalletMock } from '../src/phan-wallet-mock'
import { LOCALNET } from './utils'
import test from 'tape'

function setup(net = LOCALNET) {
  const payer = Keypair.generate()
  const wallet = PhantomWalletMock.create(net, payer, 'confirmed')
  return wallet
}

test('connection: verifying isConnected and connection events', async (t) => {
  const wallet = setup()
  t.notOk(wallet.isConnected, 'initially wallet is not connected')

  let connectedEvents = 0
  let disconnectedEvents = 0
  wallet
    .on('connect', () => connectedEvents++)
    .on('disconnect', () => disconnectedEvents++)

  t.comment('+++ Connecting wallet +++')
  await wallet.connect()
  t.ok(wallet.isConnected, 'wallet is connected')
  t.equal(connectedEvents, 1, 'total emitted "connect" once')
  t.equal(disconnectedEvents, 0, 'total emitted "disconnect" zero')

  t.comment('+++ Disconnecting wallet +++')
  await wallet.disconnect()
  t.notOk(wallet.isConnected, 'wallet is no longer connected')
  t.equal(connectedEvents, 1, 'total emitted "connect" once')
  t.equal(disconnectedEvents, 1, 'total emitted "disconnect" once')
})

test('connection: sign actions without connection', async (t) => {
  const wallet = setup()

  try {
    await wallet.signTransaction(new Transaction())
    t.fail('should throw when signing transaction')
  } catch (err: any) {
    t.match(err.message, /connect wallet/, 'throws when signing transaction')
  }

  try {
    await wallet.signMessage(Uint8Array.from([]))
    t.fail('should throw when signing message')
  } catch (err: any) {
    t.match(err.message, /connect wallet/, 'throws when signing message')
  }
})
