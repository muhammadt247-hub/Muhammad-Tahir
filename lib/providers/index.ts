import { StockProvider } from './types';
import { MockStockProvider } from './mock';
import { AdobeStockOfficialProvider } from './adobe';

export function getStockProvider(): StockProvider {
  const apiKey = process.env.ADOBE_STOCK_API_KEY?.trim();
  const productName = process.env.ADOBE_STOCK_PRODUCT_NAME?.trim() || 'DOCTORx/1.0';

  if (apiKey) {
    return new AdobeStockOfficialProvider(apiKey, productName);
  }

  return new MockStockProvider();
}

export { MockStockProvider } from './mock';
export { AdobeStockOfficialProvider } from './adobe';
export type { StockProvider } from './types';
