import {DependencyContext, PromiseHandle} from '@motion-canvas/core';
import {
  CodeToTokensBaseOptions,
  getHighlighter,
  HighlighterGeneric,
  ThemedToken,
} from 'shiki';
import {BundledLanguage} from 'shiki/langs';
import {BundledTheme} from 'shiki/themes';
import {CodeHighlighter, HighlightResult} from './CodeHighlighter';

export class ShikiCodeHighlighter implements CodeHighlighter<ThemedToken[]> {
  private highlighter!: HighlighterGeneric<any, any>;
  private promiseHandle!: PromiseHandle<HighlighterGeneric<any, any> | null>;
  private readonly options: CodeToTokensBaseOptions<
    BundledLanguage,
    BundledTheme
  >;
  private cache: {code: string; result: ThemedToken[][]}[] = [];

  public constructor(
    options: CodeToTokensBaseOptions<BundledLanguage, BundledTheme> = {
      lang: 'c#',
      theme: 'dark-plus',
    },
  ) {
    this.options = options;
    this.options.lang ??= 'c#';
    this.options.theme ??= 'dark-plus';
  }

  public highlight(index: number, cache: ThemedToken[]): HighlightResult {
    if (!cache) {
      return {
        color: null,
        skipAhead: 0,
      };
    }

    const tokenIndex = this.find(cache, index);
    const token = cache[tokenIndex];

    if (token.offset > index) {
      return {
        color: tokenIndex === 0 ? token.color! : cache[tokenIndex - 1].color!,
        skipAhead: token.offset - index,
      };
    }

    return {
      color: token.color!,
      skipAhead: token.content.length,
    };
  }

  private find(cache: ThemedToken[], value: number): number {
    let mid;
    let lo = 0;
    let hi = cache.length - 1;

    while (hi - lo > 1) {
      mid = Math.floor((lo + hi) / 2);

      if (cache[mid].offset < value) {
        lo = mid;
      } else {
        hi = mid;
      }
    }

    if (cache[lo].offset === value) return lo;

    return hi;
  }

  public initialize(): boolean {
    if (this.promiseHandle) {
      this.highlighter = this.promiseHandle.value!;
      return true;
    }

    this.promiseHandle = DependencyContext.collectPromise(
      getHighlighter({
        themes: [this.options.theme!],
        langs: [this.options.lang!],
      }),
    );
    return false;
  }

  private parse(code: string): ThemedToken[][] {
    for (const cacheElement of this.cache) {
      if (cacheElement.code === code) return cacheElement.result;
    }

    if (this.cache.length >= 10) this.cache.pop();

    const result = this.highlighter.codeToTokensBase(code, this.options);
    this.cache.push({code, result});

    return result;
  }

  public prepare(code: string): ThemedToken[] {
    return this.parse(code).flat();
  }

  public tokenize(code: string): string[] {
    const result: string[] = [];
    const tokensBase = this.parse(code);
    for (let i = 0; i < tokensBase.length; i++) {
      const tokenArray = tokensBase[i];
      for (const token of tokenArray) {
        result.push(token.content);
      }

      if (i + 1 !== tokenArray.length) result.push('\n');
    }
    return result;
  }
}
