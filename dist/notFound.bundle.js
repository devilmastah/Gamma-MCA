(()=>{"use strict";var e={2107:(e,t,r)=>{r.r(t)},71:(e,t)=>{function r(e){return JSON.parse(localStorage.getItem(e))}function o(){const e=r("theme");return"auto"!==e?e:window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}function n(e="dark"){const t="dark"===e?"light":"dark",r=document.getElementsByClassName("border-mode");for(const o of r)o.classList.replace(`border-${e}`,`border-${t}`);const o=document.getElementsByClassName("border-theme");for(const r of o)r.classList.replace(`border-${e}`,`border-${t}`),r.classList.replace(`bg-${e}`,`bg-${t}`)}function a(e){"auto"===e&&window.matchMedia("(prefers-color-scheme: dark)").matches?(document.documentElement.setAttribute("data-bs-theme","dark"),n("dark")):(document.documentElement.setAttribute("data-bs-theme",e),n(e))}Object.defineProperty(t,"__esModule",{value:!0}),t.applyTheming=t.autoThemeChange=void 0,t.autoThemeChange=function(){const e=r("theme");if("light"!==e&&"dark"!==e){const e=o();return a(e),e}return e},t.applyTheming=function(){const e=o();return a(e),e}}},t={};function r(o){var n=t[o];if(void 0!==n)return n.exports;var a=t[o]={exports:{}};return e[o](a,a.exports,r),a.exports}r.r=e=>{"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(e,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(e,"__esModule",{value:!0})},(()=>{r(2107);const e=r(71);"localStorage"in self&&(window.addEventListener("DOMContentLoaded",e.applyTheming),window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change",e.autoThemeChange))})()})();
//# sourceMappingURL=notFound.bundle.js.map