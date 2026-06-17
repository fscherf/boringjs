import nunjucks from "nunjucks";

import { Boring } from "./boring";

export class BoringNunjucksLoader extends nunjucks.Loader {
  public boring: Boring;

  async = true;

  constructor(boring: Boring) {
    super();

    this.boring = boring;
  }

  public getSourceAsync = async (
    name: string,
  ): Promise<nunjucks.LoaderSource> => {
    const template: string = await this.boring.load(name);

    return {
      src: template,
      path: "",
      noCache: false,
    };
  };

  public getSource = (
    name: string,
    callback: (err: Error | null, source: nunjucks.LoaderSource | null) => void,
  ): nunjucks.LoaderSource => {
    this.getSourceAsync(name)
      .then((res) => {
        callback(null, res);
      })
      .catch((err) => callback(err, null));

    return {
      src: "",
      path: "",
      noCache: false,
    };
  };
}
