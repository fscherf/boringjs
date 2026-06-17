# boring.js

## Usage

```javascript
// signatures -----------------------------------------------------------------
boring.addRegion(name, selector, context?);
boring.getContext(regionName);
boring.getElement(regionName);
boring.load(templateName);
boring.unload(templateName);
boring.render(regionName, templateName?, context?);
boring.addRoute(pathPattern, handler, name);
boring.getUrl(routeName, params);
boring.route(url?);

// rendering ------------------------------------------------------------------
// inital render
const context = {
    foo: "bar",
}

boring.createRegion("main", "#main");
boring.render("main", "index", context);

// rerender
const context = boring.getContext("main");

context.foo = "baz";
boring.render("main")


// routing --------------------------------------------------------------------
const context = {
    foo: "bar",
}

boring.addRegion("main", "#main", context);

boring.addRoute("/users/:name/:year/:month", (params) => {
    const context = boring.getContext("main");

    context.user.name = params.name;
    context.user.year = params.year;
    context.user.month = params.month;

    boring.render("main", "user-profile");
}, "user__profile");

boring.route();
```
