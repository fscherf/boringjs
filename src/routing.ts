import {
  match,
  compile,
  MatchFunction,
  PathFunction,
  MatchResult,
} from "path-to-regexp";

import { BoringError } from "./errors";
import { BoringRequest } from "./boring";

export type BoringRouteParams = Record<string, any>;
export type BoringRouteCallback = (request: BoringRequest) => any;

export type BoringMatchResult = {
  path: string;
  params: Record<string, string>;
};

export class BoringRoute {
  public pathPattern: string;
  public callback: BoringRouteCallback;
  public name: string | undefined;

  private _match: MatchFunction<BoringRouteParams>;
  private _toPath: PathFunction<BoringRouteParams>;

  constructor(
    pathPattern: string,
    callback: BoringRouteCallback,
    name?: string,
  ) {
    this.pathPattern = pathPattern;
    this.callback = callback;
    this.name = name;

    try {
      this._match = match<BoringRouteParams>(pathPattern);
      this._toPath = compile<BoringRouteParams>(pathPattern);
    } catch (error) {
      throw new BoringError(`Invalid path pattern: ${pathPattern}`, {
        cause: error,
      });
    }
  }

  public match = (path: string): BoringMatchResult | undefined => {
    const matchResult = this._match(path);

    if (!matchResult) {
      return undefined;
    }

    return matchResult as BoringMatchResult;
  };

  public toPath = (params: BoringRouteParams): string => {
    try {
      return this._toPath(params);
    } catch (error) {
      throw new BoringError(error + "", { cause: error });
    }
  };
}
