import {
  clusterApiUrl,
  Commitment,
  ConfirmedTransaction,
  Connection,
  ConnectionConfig,
  Finality,
  Keypair,
  LAMPORTS_PER_SOL,
  RpcResponseAndContext,
  SignatureResult,
  Signer,
  Transaction,
} from '@solana/web3.js'
export * from './types'

import { EventEmitter } from 'eventemitter3'
import { PhantomWallet, PhantomWalletEvents, TransactionSummary } from './types'
import assert_module from 'assert'

const assert: typeof import('assert') = assert_module.strict ?? assert_module

import nacl from 'tweetnacl'
import debug from 'debug'
import { forceUint8Array } from './utils'
import {
  partialSign,
  TransactionWithInternals,
  verifySignatures,
} from './web3js'
import bs58 from 'bs58'

const logInfo = debug('phan:info')
const logDebug = debug('phan:debug')
const logError = debug('phan:error')

export const DEVNET = clusterApiUrl('devnet')
export const TESTNET = clusterApiUrl('testnet')
export const MAINNET_BETA = clusterApiUrl('mainnet-beta')
export const LOCALNET = 'http://127.0.0.1:8899'

/**
 * Standin for the the [https://phantom.app/ | phantom wallet] to use while testing.
 * Behaves as much as possible as the original which is why care needs to be taken when using it.
 *
 * The main difference is that no user confirmation is required to approve a
 * transaction or signature.
 *
 * This means that user approval is automatic!
 *
 */
export class PhantomWalletMock
  extends EventEmitter<PhantomWalletEvents>
  implements PhantomWallet
{
  readonly isPhantom = true
  private _signer: Signer
  private _connection: Connection | undefined
  private _transactionSignatures: string[] = []
  private constructor(
    private readonly _connectionURL: string,
    private _keypair: Keypair,
    private readonly _commitmentOrConfig?: Commitment | ConnectionConfig
  ) {
    super()
    logInfo('Initializing Phan Wallet Mock: %o', {
      cluster: _connectionURL,
      pubkey: _keypair.publicKey.toBase58(),
      commitment: _commitmentOrConfig,
    })

    this._signer = this._signerFromKeypair(this._keypair)
  }

  _signerFromKeypair(keypair: Keypair) {
    return {
      publicKey: keypair.publicKey,
      secretKey: forceUint8Array(keypair.secretKey),
    }
  }

  // -----------------
  // Get info/properties
  // -----------------
  /**
   * The underlying connection to a fullnode JSON RPC endpoint
   */
  get connection(): Connection {
    assert(
      this._connection != null,
      'Need to connect first before getting connection'
    )
    return this._connection
  }

  /**
   * `true` if the wallet was connected via {@link PhantomWalletMock#connect}
   */
  get isConnected(): boolean {
    return this._connection != null
  }

  /**
   * Public key of the currently used wallet.
   */
  get publicKey() {
    return this._keypair.publicKey
  }

  /**
   * Secret key of the currently used wallet.
   * @category TestAPI
   */
  get secretKey() {
    return this._keypair.secretKey.toString()
  }

  /**
   * {@link Signer} of the currently used wallet.
   */
  get signer(): Signer {
    return this._signer
  }

  /**
   * Connection URL used for the underlying connection.
   * @category TestAPI
   */
  get connectionURL() {
    return this._connectionURL
  }

  /**
   * Default commitment used for transactions.
   * @category TestAPI
   */
  get commitment(): Commitment | undefined {
    const comm = this._commitmentOrConfig
    if (comm == null) return undefined
    return typeof comm === 'string' ? comm : comm.commitment
  }

  /**
   * All transactions signatures made since wallet was created ordered oldest to most recent.
   * @category TestAPI
   */
  get transactionSignatures(): string[] {
    return Array.from(this._transactionSignatures)
  }

  /**
   * Fetch the balance for the wallet's account.
   * @category TestAPI
   */
  getBalance(commitment: Commitment = 'confirmed') {
    return this.connection.getBalance(this.publicKey, commitment)
  }

  /**
   * Fetch the balance in Sol for the wallet's account.
   * @category TestAPI
   */
  async getBalanceSol(commitment: Commitment = 'confirmed') {
    const lamports = await this.getBalance(commitment)
    return lamports / LAMPORTS_PER_SOL
  }

  /**
   * Fetches transaction details for the last confirmed transaction signed with this wallet.
   * @category TestAPI
   */
  getLastConfirmedTransaction(
    commitment?: Finality
  ): Promise<null | ConfirmedTransaction> {
    const lastSig = this._transactionSignatures.pop()
    if (lastSig == null) {
      logDebug('No transaction signature found')
      return Promise.resolve(null)
    }
    return this.connection.getConfirmedTransaction(lastSig, commitment)
  }

  /**
   * Fetches transaction details for the last confirmed transaction signed with this wallet and
   * returns its summary.
   * @category TestAPI
   */
  async lastConfirmedTransactionSummary(
    commitment?: Finality
  ): Promise<TransactionSummary | undefined> {
    const tx = await this.getLastConfirmedTransaction(commitment)
    if (tx == null) return

    const logMessages = tx.meta?.logMessages ?? []
    const fee = tx.meta?.fee
    const slot = tx.slot
    const blockTime = tx.blockTime ?? 0
    const err = tx.meta?.err
    return { logMessages, fee, slot, blockTime, err }
  }

  /**
   * Fetches transaction details for the last confirmed transaction signed with this wallet and
   * returns its summary that can be used to log it to the console.
   * @category TestAPI
   */
  async lastConfirmedTransactionString(commitment?: Finality): Promise<string> {
    const tx = await this.getLastConfirmedTransaction(commitment)
    if (tx == null) {
      return 'No confirmed transaction found'
    }
    const logs = tx.meta?.logMessages?.join('\n  ')
    const fee = tx.meta?.fee
    const slot = tx.slot
    const blockTimeSecs = new Date(tx.blockTime ?? 0).getSeconds()
    const err = tx.meta?.err
    return `fee: ${fee} slot: ${slot} blockTime: ${blockTimeSecs}s err: ${err}
  ${logs}`
  }

  // -----------------
  // Signing Transactions
  // -----------------
  /**
   * Signs the transaction using the current wallet.
   */
  signTransaction(txIn: Transaction): Promise<Transaction> {
    const transaction: TransactionWithInternals =
      txIn as TransactionWithInternals
    transaction._partialSign = partialSign.bind(transaction)
    transaction._verifySignatures = verifySignatures.bind(transaction)

    logDebug(
      'Attempting to sign transaction with %d instruction(s)',
      transaction.instructions.length
    )
    return new Promise(async (resolve, reject) => {
      try {
        assert(this._connection != null, 'Need to connect wallet first')

        const { blockhash } = await this._connection.getRecentBlockhash()
        transaction.recentBlockhash = blockhash

        transaction.sign(this._signer)
        logDebug('Signed transaction successfully')
        this._transactionSignatures.push(bs58.encode(transaction.signature!))
        resolve(transaction)
      } catch (err) {
        logError('Failed signing transaction')
        logError(err)
        reject(err)
      }
    })
  }

  /**
   * Signs all transactions using the current wallet.
   */
  signAllTransactions(transactions: Transaction[]): Promise<Transaction[]> {
    logDebug('Signing %d transactions', transactions.length)
    return Promise.all(transactions.map((tx) => this.signTransaction(tx)))
  }

  // -----------------
  // Signing Message
  // -----------------
  /**
   * Signs the message using the current wallet.
   */
  signMessage(message: Uint8Array): Promise<{ signature: Uint8Array }> {
    return new Promise(async (resolve, reject) => {
      try {
        assert(this._connection != null, 'Need to connect wallet first')
        const signature = nacl.sign.detached(
          forceUint8Array(message),
          this._keypair.secretKey
        )
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

  // -----------------
  // Managing Connection
  // -----------------
  /**
   * Connects the wallet to the URL provided on wallet creation.
   * This needs to be called before attempting to sign messages or transactions.
   *
   * emits 'connect'
   */
  async connect(): Promise<void> {
    this._connection = new Connection(
      this._connectionURL,
      this._commitmentOrConfig
    )
    logDebug('wallet connected')
    this.emit('connect')
    return Promise.resolve()
  }

  /**
   * Disconnects the wallet.
   *
   * emits 'disconnect'
   */
  disconnect(): Promise<void> {
    this._connection = undefined
    logDebug('wallet disconnected')
    this._handleDisconnect()
    return Promise.resolve()
  }

  _handleDisconnect(...args: unknown[]): unknown {
    return this.emit('disconnect', args)
  }

  // -----------------
  // Added convenience API for Testing purposes
  // -----------------
  /**
   * Drops sol to the currently connected wallet.
   * @category TestAPI
   */
  async requestAirdrop(
    sol: number
  ): Promise<RpcResponseAndContext<SignatureResult>> {
    assert(this._connection != null, 'Need to connect requesting airdrop')

    const signature = await this._connection.requestAirdrop(
      this.publicKey,
      LAMPORTS_PER_SOL * sol
    )
    return this.connection.confirmTransaction(signature)
  }

  /**
   * Changes the Wallet to the provided keypair
   * This updates the signer as well.
   * @category TestAPI
   */
  changeWallet(keypair: Keypair) {
    this._keypair = keypair
    this._signer = this._signerFromKeypair(keypair)
  }

  /**
   * Creates a {@see PhantomWalletMock} instance with the provided info.
   *
   * @param connectionURL cluster to connect to, i.e. `https://api.devnet.solana.com` or `http://127.0.0.1:8899`
   * @param keypair the private and public key of the wallet to use, i.e. the payer/signer
   * @param commitmentOrConfig passed to the {@link * https://solana-labs.github.io/solana-web3.js/classes/Connection.html#constructor }
   *                           when creating a connection to the cluster
   */
  static create = (
    connectionURL: string,
    keypair: Keypair = Keypair.generate(),
    commitmentOrConfig?: Commitment | ConnectionConfig
  ) => new PhantomWalletMock(connectionURL, keypair, commitmentOrConfig)
}

export const initWalletMockProvider = (winin: Window) => {
  const win = winin as Window & { solana: PhantomWallet | undefined }
  const payer = Keypair.generate()
  const wallet = PhantomWalletMock.create(LOCALNET, payer, 'confirmed')
  win.solana = wallet
  return { wallet, payer }
}
