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

class PhantomWalletMock
  extends EventEmitter<PhantomWalletEvents>
  implements PhantomWallet
{
  readonly isPhantom = true
  private _connection: Connection | undefined
  constructor(
    private readonly _connectionURL: string,
    private readonly _keypair: Keypair,
    private readonly _commitmentOrConfig?: Commitment | ConnectionConfig
  ) {
    super()
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
    return new Promise(async (resolve, reject) => {
      try {
        assert(this._connection != null, 'Need to connect wallet first')

        const { blockhash } = await this._connection.getRecentBlockhash()
        transaction.recentBlockhash = blockhash

        transaction.sign(this.signer)
        resolve(transaction)
      } catch (err) {
        reject(err)
      }
    })
  }

  signAllTransactions(transactions: Transaction[]): Promise<Transaction[]> {
    return Promise.all(transactions.map((tx) => this.signTransaction(tx)))
  }

  signMessage(message: Uint8Array): Promise<{ signature: Uint8Array }> {
    throw new Error('Method not implemented.')
  }

  connect(): Promise<void> {
    this._connection = new Connection(
      this._connectionURL,
      this._commitmentOrConfig
    )
    return Promise.resolve()
  }

  disconnect(): Promise<void> {
    this._connection = undefined
    return Promise.resolve()
  }

  _handleDisconnect(...args: unknown[]): unknown {
    throw new Error('Method not implemented.')
  }
}

export const createWalletMock = (
  connectionURL: string,
  keypair: Keypair,
  commitmentOrConfig?: Commitment | ConnectionConfig
) => new PhantomWalletMock(connectionURL, keypair, commitmentOrConfig)
