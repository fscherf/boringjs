function loadingLinkedAbsolutePathScriptFunction() {
  const element = document.querySelector("#absolute-path-js");
  
  element.classList.remove("loading-error");
  
  element.innerHTML = "Loading JS from absolute URLs works";
}
