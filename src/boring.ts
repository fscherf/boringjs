import morphdom from "morphdom";
import nunjucks from "nunjucks";

import {
  BoringRoute,
  BoringMatchResult,
  BoringRouteCallback,
  BoringRouteParams,
} from "./routing";

import { BoringTemplateLoader } from "./template-loader";
import { BoringNunjucksLoader } from "./templating";
import { BoringError } from "./errors";

declare global {
  interface Window {
    boring: Boring;
  }
}

type BoringConfig = {
  loadingHashAttributeName: string;
  templatingUrlPrefix: string;
  templatingNamePrefix: string;
  templatingNameAttributeName: string;
  renderingIgnoreAttributeName: string;
};

type BoringRegion = {
  element: HTMLElement;
  templateName?: string;
  context: object;
};

export class Boring {
  private nunjucksEnv: nunjucks.Environment;
  private templateLoader: BoringTemplateLoader;

  public config: BoringConfig;
  public regions: Map<string, BoringRegion>;
  public routes: Array<BoringRoute>;
  public routesByName: Map<string, BoringRoute>;

  constructor() {
    this.config = {
      loadingHashAttributeName: "hash",
      templatingUrlPrefix: "/templates/",
      templatingNamePrefix: "",
      templatingNameAttributeName: "name",
      renderingIgnoreAttributeName: "boring-ignore",
    };

    this.regions = new Map();
    this.routes = new Array();
    this.routesByName = new Map();

    this.templateLoader = new BoringTemplateLoader(this);
    this.nunjucksEnv = new nunjucks.Environment(new BoringNunjucksLoader(this));
  }

  // events -------------------------------------------------------------------
  public dispatchEvent = ({
    name,
    regionName = "",
    cancelable = false,
    detail = {},
  }: {
    name: string;
    regionName?: string;
    cancelable?: boolean;
    detail?: Record<string, unknown>;
  }): boolean => {
    // specific event
    const fullEventName: string = `boring:${name}`;

    let element: HTMLElement = document.body;

    if (regionName) {
      const region: BoringRegion = this.getRegion(regionName);

      element = region.element;
    }

    const event = new CustomEvent(fullEventName, {
      bubbles: true,
      cancelable: cancelable,
      detail: detail,
    });

    const returnValue = element.dispatchEvent(event);

    // generic event
    const genericEvent = new CustomEvent("boring:event", {
      bubbles: true,
      cancelable: false,
      detail: {
        event: event,
      },
    });

    element.dispatchEvent(genericEvent);

    return returnValue;
  };

  // regions ------------------------------------------------------------------
  private getRegion = (name: string): BoringRegion => {
    const region: BoringRegion | undefined = this.regions.get(name);

    if (region === undefined) {
      throw new BoringError(`Unknown region: '${name}'`);
    }

    return region;
  };

  public addRegion = (
    name: string,
    selector: string,
    context?: Object,
  ): void => {
    // check name
    if (this.regions.has(name)) {
      throw new BoringError(`region with name '${name}' already exists`);
    }

    // find element
    const elements: NodeList = document.querySelectorAll(selector);

    if (elements.length != 1) {
      throw new BoringError(
        `'${selector}' does not point to a singular DOM element`,
      );
    }

    if (elements[0].nodeType != Node.ELEMENT_NODE) {
      throw new BoringError(`'${selector}' does not point to an element`);
    }

    const element: HTMLElement = elements[0] as HTMLElement;

    // check if element is already a region
    for (const [name, region] of this.regions) {
      if (region.element.isSameNode(element)) {
        throw new BoringError(
          `'${selector}' points to ${element} which is already part of region '${name}}'`,
        );
      }
    }

    // create region
    this.regions.set(name, {
      element: element,
      context: context || {},
    });
  };

  public getContext = (selector: string): Object => {
    return this.getRegion(selector).context;
  };

  public getElement = (selector: string): HTMLElement => {
    return this.getRegion(selector).element;
  };

  // loading ------------------------------------------------------------------
  public load = async (templateName: string): Promise<string> => {
    // NOTE: We do this detour from the templating engine, through this class,
    // to `TemplateLoader.load`, so endusers can invoke calls like
    // `boring.load("index")` to preload templates.

    return this.templateLoader.load(templateName);
  };

  public unload = async (templateName: string): Promise<void> => {
    // TODO: implement
    // figure out dependencies of templates and unload them too

    throw new BoringError("not implemented yet");
  };

  // rendering ----------------------------------------------------------------
  public render = async (
    regionName: string,
    templateName?: string,
    context?: Object,
  ) => {
    // Dispatches:
    //   before-render (cancelable)
    //   after-render
    //   render-error

    // TODO: use config.renderingIgnoreAttributeName
    const region: BoringRegion = this.getRegion(regionName);

    // dispatch before-render event
    const eventCanceled: boolean = !this.dispatchEvent({
      name: "before-render",
      regionName: regionName,
      cancelable: true,
      detail: {
        templateName: templateName,
        regionName: regionName,
      },
    });

    if (eventCanceled) {
      return;
    }

    try {
      // update region state
      region.templateName = templateName || region.templateName;
      region.context = context || region.context;

      if (region.templateName === undefined) {
        throw new BoringError("no template set");
      }

      const html: string = await new Promise((resolve, reject) => {
        this.nunjucksEnv.render(
          region.templateName as string,
          region.context,
          (error: Error | null, html: string | null) => {
            if (error) {
              reject(error);
            }

            if (typeof html !== "string") {
              reject(new BoringError("templating did not return a string"));
            }

            resolve(html as string);
          },
        );
      });

      // parse templated HTML
      const domParser = new DOMParser();
      const newDocument = domParser.parseFromString(html, "text/html");

      // render new HTML into the regions element
      morphdom(region.element, newDocument.body, {
        childrenOnly: true,

        onBeforeElUpdated: (fromEl: HTMLElement, toEl: HTMLElement) => {
          // Preserve the value of `fromEl` if both elements are form elements
          // and the new form element does not explicitly set a new value.

          // input
          if (
            fromEl instanceof HTMLInputElement &&
            toEl instanceof HTMLInputElement
          ) {
            // checkbox / radio
            if (toEl.type === "checkbox" || toEl.type === "radio") {
              if (!toEl.hasAttribute("checked")) {
                toEl.checked = fromEl.checked;
              }
              // input
            } else {
              if (!toEl.hasAttribute("value")) {
                toEl.value = fromEl.value;
              }
            }

            // textarea
          } else if (
            fromEl instanceof HTMLTextAreaElement &&
            toEl instanceof HTMLTextAreaElement
          ) {
            if (toEl.defaultValue === "") {
              toEl.value = fromEl.value;
            }

            // select
          } else if (
            fromEl instanceof HTMLSelectElement &&
            toEl instanceof HTMLSelectElement
          ) {
            const hasExplicitSelection = Array.from(toEl.options).some((opt) =>
              opt.hasAttribute("selected"),
            );

            if (!hasExplicitSelection) {
              toEl.value = fromEl.value;
            }
          }

          return true;
        },
      });
    } catch (error) {
      this.dispatchEvent({
        name: "render-error",
        regionName: regionName,
        cancelable: false,
        detail: {
          templateName: templateName,
          regionName: regionName,
          error: error,
        },
      });

      throw error;
    }

    // dispatch after-render event
    this.dispatchEvent({
      name: "after-render",
      regionName: regionName,
      cancelable: false,
      detail: {
        templateName: templateName,
        regionName: regionName,
      },
    });
  };

  // routing ------------------------------------------------------------------
  private getMatchingRoute = (
    path: string,
  ): [BoringRoute | undefined, BoringMatchResult | undefined] => {
    for (const route of this.routes) {
      const matchResult: BoringMatchResult | undefined = route.match(path);

      if (matchResult) {
        return [route, matchResult];
      }
    }

    return [undefined, undefined];
  };

  public route = async (
    path?: string,
    navigateEvent?: NavigateEvent,
    matchingRoute?: BoringRoute,
    matchResult?: BoringMatchResult,
  ): Promise<boolean> => {
    // Dispatches:
    //  - before-routing (cancelable)
    //  - routing-hit
    //  - routing-miss
    //  - after-routing
    //  - routing-error

    if (!path) {
      path = window.location.pathname;
    }

    // dispatch `before-routing`
    // If the event gets cancelled, we stop routing here.
    const eventCanceled: boolean = !this.dispatchEvent({
      name: "before-routing",
      cancelable: true,
      detail: {
        path: path,
        navigateEvent: navigateEvent,
      },
    });

    if (eventCanceled) {
      return false;
    }

    // search for matching route if necessary
    if (!matchingRoute) {
      for (const route of this.routes) {
        matchResult = route.match(path);

        if (matchResult) {
          matchingRoute = route;

          break;
        }
      }
    }

    // hit
    if (matchingRoute) {
      // dispatch `routing-hit`
      this.dispatchEvent({
        name: "routing-hit",
        cancelable: false,
        detail: {
          path: path,
          navigateEvent: navigateEvent,
          routePathPattern: matchingRoute.pathPattern,
          routeCallback: matchingRoute.callback,
          routeName: matchingRoute.name,
        },
      });

      // run callback
      try {
        const params = matchResult || {};
        const returnValue = matchingRoute.callback(params, navigateEvent);

        if (returnValue instanceof Promise) {
          await returnValue;
        }
      } catch (error) {
        this.dispatchEvent({
          name: "routing-error",
          cancelable: false,
          detail: {
            path: path,
            navigateEvent: navigateEvent,
            routePathPattern: matchingRoute.pathPattern,
            routeCallback: matchingRoute.callback,
            routeName: matchingRoute.name,
            error: error,
          },
        });

        let routeIdentifier: string =
          matchingRoute.name || matchingRoute.pathPattern;

        throw new BoringError(
          `error thrown while running callback for ${routeIdentifier}`,
          {
            cause: error,
          },
        );
      }
    }

    // miss
    if (!matchingRoute) {
      // dispatch `routing-miss`
      this.dispatchEvent({
        name: "routing-miss",
        cancelable: false,
        detail: {
          path: path,
          navigateEvent: navigateEvent,
        },
      });
    }

    // dispatch `after-routing`
    this.dispatchEvent({
      name: "after-routing",
      cancelable: false,
      detail: {
        path: path,
        navigateEvent: navigateEvent,
      },
    });

    // return true if we had an hit
    const hit: boolean = matchingRoute !== undefined;

    return hit;
  };

  public addRoute = (
    pathPattern: string,
    callback: BoringRouteCallback,
    name?: string,
  ) => {
    const route: BoringRoute = new BoringRoute(pathPattern, callback, name);

    this.routes.push(route);

    if (name) {
      this.routesByName.set(name, route);
    }

    // setup routing events
    if (this.routes.length != 1) {
      return;
    }

    if (!window.navigation) {
      throw new BoringError("navigate API is not available");
    }

    navigation.addEventListener("navigate", (event: NavigateEvent) => {
      if (
        !event.canIntercept ||
        event.hashChange ||
        event.downloadRequest !== null
      ) {
        return;
      }

      const path: string = new URL(event.destination.url).pathname;
      const [matchingRoute, matchResult] = this.getMatchingRoute(path);

      if (!matchingRoute) {
        return;
      }

      event.intercept({
        handler: async () => {
          await this.route(path, event, matchingRoute);
        },
      });
    });
  };

  public getUrl = (routeName: string, params: BoringRouteParams): string => {
    const route: BoringRoute | undefined = this.routesByName.get(routeName);

    if (!route) {
      throw new BoringError(`Unknown route '${routeName}'`);
    }

    return route.toPath(params);
  };
}

window.boring = new Boring();
