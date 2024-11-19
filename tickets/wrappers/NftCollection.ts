import { 
  Address, 
  beginCell, 
  Cell, 
  Contract, 
  contractAddress, 
  ContractProvider, 
  Sender, 
  SendMode,
  Dictionary,
  toNano 
} from '@ton/core';

export type RoyaltyParams = {
  factor: number;
  base: number;
  address: Address;
};

export type NftCollectionConfig = {
  ownerAddress: Address;
  nextItemIndex: number;
  collectionContent: string;
  commonContent: string;
  nftItemCode: Cell;
  royaltyParams: RoyaltyParams;
  mintPrice: bigint;
  maxSupply: number;
  endTime: number;
  refundPercent: number;
  ticketsSold: number;
};

export function nftCollectionConfigToCell(config: NftCollectionConfig): Cell {
  const royaltyCell = beginCell()
    .storeUint(config.royaltyParams.factor, 16)
    .storeUint(config.royaltyParams.base, 16)
    .storeAddress(config.royaltyParams.address)
    .endCell();

  const contentCell = beginCell()
    .storeRef(beginCell().storeUint(0x01, 8).storeStringRefTail(config.collectionContent).endCell())
    .storeStringRefTail(config.commonContent)
    .endCell();

  return beginCell()
    .storeAddress(config.ownerAddress)
    .storeUint(config.nextItemIndex, 64)
    .storeRef(contentCell)
    .storeRef(config.nftItemCode)
    .storeRef(royaltyCell)
    .storeCoins(config.mintPrice)
    .storeUint(config.maxSupply, 64)
    .storeUint(config.endTime, 64)
    .storeUint(config.refundPercent, 16)
    .storeUint(config.ticketsSold, 64)
    .endCell();
}

export class NftCollection implements Contract {
  constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

  static createFromAddress(address: Address) {
    return new NftCollection(address);
  }

  static createFromConfig(config: NftCollectionConfig, code: Cell, workchain = 0) {
    const data = nftCollectionConfigToCell(config);
    const init = { code, data };
    return new NftCollection(contractAddress(workchain, init), init);
  }

  async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
    await provider.internal(via, {
      value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell().endCell(),
    });
  }

  async sendMintNft(
    provider: ContractProvider,
    via: Sender,
    opts: {
      value: bigint;
      itemIndex: number;
      amount: bigint;
      content: string;
    }
  ) {
    const contentCell = beginCell().storeBuffer(Buffer.from(opts.content)).endCell();
    const itemMessage = beginCell().storeAddress(via.address).storeRef(contentCell).endCell();
    await provider.internal(via, {
      value: opts.value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(1, 32) // op
        .storeUint(0, 64) // query id
        .storeUint(opts.itemIndex, 64)
        .storeCoins(opts.amount)
        .storeRef(itemMessage)
        .endCell(),
    });
  }

  async sendBatchMintNft(
    provider: ContractProvider,
    via: Sender,
    opts: {
      value: bigint;
      deployList: Dictionary<number, { amount: bigint; content: Cell }>;
    }
  ) {
    await provider.internal(via, {
      value: opts.value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(2, 32) // op
        .storeUint(0, 64) // query id
        .storeRef(beginCell()
          .storeDictDirect(opts.deployList, Dictionary.Keys.Uint(64), {
            serialize: (src, cell) => {
              cell.storeCoins(src.amount)
                .storeRef(src.content);
            },
            parse: (src) => {
              return {
                amount: src.loadCoins(),
                content: src.loadRef()
              };
            }
          })
          .endCell())
        .endCell(),
    });
  }

  async sendChangeOwner(
    provider: ContractProvider,
    via: Sender,
    opts: {
      value: bigint;
      newOwner: Address;
    }
  ) {
    await provider.internal(via, {
      value: opts.value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(3, 32) // op
        .storeUint(0, 64) // query id
        .storeAddress(opts.newOwner)
        .endCell(),
    });
  }

  async sendChangeContent(
    provider: ContractProvider,
    via: Sender,
    opts: {
      value: bigint;
      newContent: Cell;
    }
  ) {
    await provider.internal(via, {
      value: opts.value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(4, 32) // op
        .storeUint(0, 64) // query id
        .storeRef(opts.newContent)
        .endCell(),
    });
  }

  async getCollectionData(provider: ContractProvider) {
    const { stack } = await provider.get('get_collection_data', []);
    return {
      nextItemIndex: stack.readNumber(),
      content: stack.readCell(),
      ownerAddress: stack.readAddress()
    };
  }

  async getNftAddressByIndex(provider: ContractProvider, index: number) {
    const { stack } = await provider.get('get_nft_address_by_index', [{
      type: 'int',
      value: BigInt(index)
    }]);
    return stack.readAddress();
  }

  async getRoyaltyParams(provider: ContractProvider) {
    const { stack } = await provider.get('royalty_params', []);
    return {
      factor: stack.readNumber(),
      base: stack.readNumber(),
      address: stack.readAddress()
    };
  }

  async getCollectionLimits(provider: ContractProvider) {
    const { stack } = await provider.get('get_collection_limits', []);
    return {
      mintPrice: stack.readNumber(),
      maxSupply: stack.readNumber(),
      endTime: stack.readNumber(),
      refundPercent: stack.readNumber()
    };
  }

  async getNftContent(
    provider: ContractProvider, 
    index: number, 
    individualContent: Cell
  ) {
    const { stack } = await provider.get('get_nft_content', [
      { type: 'int', value: BigInt(index) },
      { type: 'cell', cell: individualContent }
    ]);
    return stack.readCell();
  }

  async getTicketsSold(provider: ContractProvider) {
    const { stack } = await provider.get('get_tickets_sold', []);
    return stack.readNumber();
  }
}