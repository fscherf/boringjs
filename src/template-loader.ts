import { resolveUrl, hashString } from "./utils";
import { BoringError } from "./errors";
import { Boring } from "./boring";

export class BoringTemplateLoader {
  public boring: Boring;

  constructor(boring: Boring) {
    this.boring = boring;
  }

  private resolveTemplateUrls = (
    url: string,
    templateElement: HTMLTemplateElement,
  ) => {
    // images
    const imgElements = templateElement.content.querySelectorAll("img");

    imgElements.forEach((element: Element) => {
      let src: string = element.getAttribute("src") || "";

      if (!src) {
        return;
      }

      src = resolveUrl({
        baseUrl: url,
        templatingUrlPrefix: this.boring.config.templatingUrlPrefix,
        relativeUrl: src,
      });

      element.setAttribute("src", src);
    });
  };

  private generateTemplate = async (
    url: string,
    newDocument: Document,
    template: string,
  ) => {
    const element: HTMLTemplateElement = document.createElement("template");

    element.setAttribute(
      this.boring.config.templatingNameAttributeName,
      template,
    );

    element.innerHTML = newDocument.body.innerHTML;

    this.resolveTemplateUrls(url, element);

    document.body.appendChild(element);
  };

  private loadLinkedStyles = async (url: string, newDocument: Document) => {
    const linkElements = newDocument.querySelectorAll("link[rel=stylesheet]");

    linkElements.forEach((element: Element) => {
      element.remove();

      // check if href is set
      let href: string = element.getAttribute("href") || "";

      if (!href) {
        return;
      }

      // resolve relative URLs
      href = resolveUrl({
        baseUrl: url,
        templatingUrlPrefix: this.boring.config.templatingUrlPrefix,
        relativeUrl: href,
      });

      element.setAttribute("href", href);

      // check if linked style is already loaded
      const selector: string = `link[href="${href}"]`;

      if (document.querySelector(selector)) {
        return;
      }

      // attach linked style to original document
      document.head.appendChild(element);
    });
  };

  private loadStyles = async (newDocument: Document) => {
    const styleElements = newDocument.querySelectorAll("style");

    styleElements.forEach((element: HTMLStyleElement) => {
      element.remove();

      const hash: string = hashString(element.innerHTML);
      const selector: string = `style[${this.boring.config.loadingHashAttributeName}="${hash}"]`;

      // check if style is already loaded
      if (document.querySelector(selector)) {
        return;
      }

      // attach template to original document
      element.setAttribute(this.boring.config.loadingHashAttributeName, hash);

      document.head.appendChild(element);
    });
  };

  private loadScripts = async (url: string, newDocument: Document) => {
    const scriptElements = newDocument.querySelectorAll("script");
    const scriptsLoaded = new Array();

    scriptElements.forEach((element: HTMLScriptElement) => {
      element.remove();

      // check if script is already loaded
      let src: string = element.getAttribute("src") || "";
      let hash: string = "";
      let selector: string = "";

      if (src) {
        src = resolveUrl({
          baseUrl: url,
          templatingUrlPrefix: this.boring.config.templatingUrlPrefix,
          relativeUrl: src,
        });

        selector = `script[src="${src}"]`;
      } else {
        hash = hashString(element.textContent);
        selector = `script[${this.boring.config.loadingHashAttributeName}="${hash}"]`;
      }

      // check if script is already loaded
      if (document.querySelector(selector)) {
        return;
      }

      // load script
      // We need to create a new element so our original document will run it.
      const newElement: HTMLScriptElement = document.createElement("script");

      for (const attribute of element.attributes) {
        newElement.setAttribute(attribute.name, attribute.value);
      }

      if (src) {
        newElement.setAttribute("src", src);
      }

      if (hash) {
        newElement.setAttribute(
          this.boring.config.loadingHashAttributeName,
          hash,
        );
      }

      if (!element.src) {
        newElement.textContent = element.textContent;
      } else {
        const promise = new Promise((resolve) => {
          newElement.addEventListener("load", () => {
            resolve(null);
          });
        });

        scriptsLoaded.push(promise);
      }

      document.body.appendChild(newElement);
    });

    await Promise.all(scriptsLoaded);
  };

  private loadTemplates = async (url: string, newDocument: Document) => {
    const scriptElements = newDocument.querySelectorAll("template");

    scriptElements.forEach((element: HTMLTemplateElement) => {
      // Check if the template has a name set. If not, we just leave it in the
      // document because it could be used by a 3rd party library.
      const name: string =
        element.getAttribute(this.boring.config.templatingNameAttributeName) ||
        "";

      if (!name) {
        return;
      }

      element.remove();

      // check if template with this name already exists
      const selector: string = `template[${this.boring.config.templatingNameAttributeName}="${name}"]`;

      if (document.querySelector(selector)) {
        return;
      }

      // attach template to original document
      this.resolveTemplateUrls(url, element);

      document.body.appendChild(element);
    });
  };

  private fetch = async (template: string) => {
    // Dispatches:
    //   before-template-fetch
    //   after-template-fetch
    //   template-fetch-error
    //   template-load-error

    // fetch template source
    let url: string = "";
    let response: Response | undefined = undefined;

    this.boring.dispatchEvent({
      name: "before-template-fetch",
      cancelable: false,
      detail: {
        templateName: template,
      },
    });

    try {
      url = `${this.boring.config.templatingUrlPrefix}${template}.html`;
      response = await fetch(url);

      // run checks
      if (!response.ok) {
        throw new BoringError(`unknown template: ${template}`);
      }

      if (
        !(response.headers.get("content-type") || "").startsWith("text/html")
      ) {
        throw new BoringError(`invalid template: ${template}`);
      }

      // success
      this.boring.dispatchEvent({
        name: "after-template-fetch",
        cancelable: false,
        detail: {
          templateName: template,
        },
      });
    } catch (error) {
      this.boring.dispatchEvent({
        name: "template-fetch-error",
        cancelable: false,
        detail: {
          templateName: template,
          url: url,
          response: response,
          error: error,
        },
      });

      throw error;
    }

    // parse template
    try {
      const html: string = await response.text();

      if (!html) {
        throw new BoringError(`invalid template: ${template}`);
      }

      // parse HTML
      const domParser = new DOMParser();
      const newDocument = domParser.parseFromString(html, "text/html");

      // load HTML parts
      await this.loadLinkedStyles(url, newDocument);
      await this.loadStyles(newDocument);
      await this.loadScripts(url, newDocument);
      await this.loadTemplates(url, newDocument);

      // create template from remaining HTML if not empty
      if (/\S/.test(newDocument.body.innerHTML)) {
        this.generateTemplate(url, newDocument, template);
      }
    } catch (error) {
      this.boring.dispatchEvent({
        name: "template-load-error",
        cancelable: false,
        detail: {
          templateName: template,
          error: error,
        },
      });

      throw error;
    }
  };

  public load = async (template: string): Promise<string> => {
    // Dispatches:
    //   before-template-load
    //   after-template-load

    const templateSelector: string = `template[${this.boring.config.templatingNameAttributeName}="${template}"]`;
    let templateElement: HTMLTemplateElement | null;

    this.boring.dispatchEvent({
      name: "before-template-load",
      cancelable: false,
      detail: {
        templateName: template,
      },
    });

    templateElement = document.querySelector(templateSelector);

    if (!templateElement) {
      await this.fetch(template);
    }

    templateElement = document.querySelector(templateSelector);

    if (!templateElement) {
      throw new BoringError(`unknown template: ${template}`);
    }

    this.boring.dispatchEvent({
      name: "after-template-load",
      cancelable: false,
      detail: {
        templateName: template,
      },
    });

    return templateElement.innerHTML;
  };
}
