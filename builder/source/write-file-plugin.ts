import Path from "path";
import Webpack from "webpack";

export default class WebpackWriteFilePlugin {
  public constructor(
    public readonly options: {
      readonly path?: string;
      readonly name: string;
      readonly content: Buffer;
    }
  ) {
    if (!options.name) throw new Error(`File name must not be empty`);
  }

  private get assetName(): string {
    return Path.join(this.options.path || "", this.options.name);
  }

  private get asset() {
    return {
      source: () => this.options.content,
      buffer: () => this.options.content,
      size: () => this.options.content.length,
    };
  }

  public apply(compiler: Webpack.Compiler) {
    compiler.hooks.make.tap("WebpackWriteFilePlugin", (compilation) => {
      // We cast the 'asset' to 'any' here to avoid type-check complaints for
      // optional properties not specified as optional in @types/webpack
      compilation.assets[this.assetName] = this.asset as any;
    });
  }
}
