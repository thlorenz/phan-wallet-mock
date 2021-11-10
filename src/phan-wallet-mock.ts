import {
  Commitment,
  Connection,
  ConnectionConfig,
  Keypair,
  Signer,
  Transaction,
} from '@solana/web3.js'
import { EventEmitter } from 'eventemitter3'
import { PhantomWallet, PhantomWalletEvents } from './types'
import { strict as assert } from 'assert'

import nacl from 'tweetnacl'
import debug from 'debug'

const logInfo = debug('phan:info')
const logDebug = debug('phan:debug')
const logError = debug('phan:error')

export class PhantomWalletMock
  extends EventEmitter<PhantomWalletEvents>
  implements PhantomWallet
{
  readonly isPhantom = true
  private _connection: Connection | undefined
  private constructor(
    private readonly _connectionURL: string,
    private readonly _keypair: Keypair,
    private readonly _commitmentOrConfig?: Commitment | ConnectionConfig
  ) {
    super()
    logInfo('Initializing Phan Wallet Mock: %o', {
      cluster: _connectionURL,
      pubkey: _keypair.publicKey.toBase58(),
      commitment: _commitmentOrConfig,
    })
  }

  get connection(): Connection {
    assert(
      this._connection != null,
      'Need to connect first before getting connection'
    )
    return this._connection
  }

  get isConnected(): boolean {
    return this._connection != null
  }

  get publicKey() {
    return this._keypair.publicKey
  }

  get signer(): Signer {
    return {
      publicKey: this._keypair.publicKey,
      secretKey: this._keypair.secretKey,
    }
  }

  signTransaction(transaction: Transaction): Promise<Transaction> {
    logDebug(
      'Attempting to sign transaction with %d instruction(s)',
      transaction.instructions.length
    )
    return new Promise(async (resolve, reject) => {
      try {
        assert(this._connection != null, 'Need to connect wallet first')

        const { blockhash } = await this._connection.getRecentBlockhash()
        transaction.recentBlockhash = blockhash

        transaction.sign(this.signer)
        logDebug('Signed transaction successfully')
        resolve(transaction)
      } catch (err) {
        logError('Failed signing transaction')
        logError(err)
        reject(err)
      }
    })
  }

  signAllTransactions(transactions: Transaction[]): Promise<Transaction[]> {
    logDebug('Signing %d transactions', transactions.length)
    return Promise.all(transactions.map((tx) => this.signTransaction(tx)))
  }

  signMessage(message: Uint8Array): Promise<{ signature: Uint8Array }> {
    return new Promise(async (resolve, reject) => {
      try {
        assert(this._connection != null, 'Need to connect wallet first')
        const signature = nacl.sign.detached(message, this._keypair.secretKey)
        const res = {
          signature,
          publicKey: this._keypair.publicKey,
        }
        return resolve(res)
      } catch (err) {
        logError('Failed signing message')
        logError(err)
        reject(err)
      }
    })
  }

  connect(): Promise<void> {
    this._connection = new Connection(
      this._connectionURL,
      this._commitmentOrConfig
    )
    logDebug('wallet connected')
    this.emit('connect')
    return Promise.resolve()
  }

  disconnect(): Promise<void> {
    this._connection = undefined
    logDebug('wallet disconnected')
    this._handleDisconnect()
    return Promise.resolve()
  }

  _handleDisconnect(...args: unknown[]): unknown {
    return this.emit('disconnect', args)
  }

  static create = (
    connectionURL: string,
    keypair: Keypair,
    commitmentOrConfig?: Commitment | ConnectionConfig
  ) => new PhantomWalletMock(connectionURL, keypair, commitmentOrConfig)
}
