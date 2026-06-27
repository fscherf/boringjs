function loadingLinkedRelativePathScriptFunction() {
  const element = document.querySelector("#relative-path-js");
  
  element.classList.remove("loading-error");
  
  element.innerHTML = "Loading JS from relative URLs works";
}
