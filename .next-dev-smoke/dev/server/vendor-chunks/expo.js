"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "vendor-chunks/expo";
exports.ids = ["vendor-chunks/expo"];
exports.modules = {

/***/ "(ssr)/./node_modules/expo/build/utils/getBundleOrigin.js":
/*!**********************************************************!*\
  !*** ./node_modules/expo/build/utils/getBundleOrigin.js ***!
  \**********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   getBundleOrigin: () => (/* binding */ getBundleOrigin),\n/* harmony export */   getBundleUrl: () => (/* reexport safe */ _getBundleUrl__WEBPACK_IMPORTED_MODULE_0__.getBundleUrl)\n/* harmony export */ });\n/* harmony import */ var _getBundleUrl__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./getBundleUrl */ \"(ssr)/./node_modules/expo/build/utils/getBundleUrl.web.js\");\n// Copyright 2015-present 650 Industries. All rights reserved.\n\n\n/**\n * Origin the running bundle was served from, or `null` when it wasn't served over HTTP.\n *\n * This is the address the runtime actually reached, so it stays correct when a development server is\n * reached through an address it can't observe itself, such as a proxy or a tunnel. It's the value to\n * build other development server requests from, in place of an address the server reports for itself.\n *\n * A bundle loaded from disk has a `file:` URL, which is no address to resolve anything against.\n */ function getBundleOrigin(bundleUrl = (0,_getBundleUrl__WEBPACK_IMPORTED_MODULE_0__.getBundleUrl)()) {\n    if (!bundleUrl) {\n        return null;\n    }\n    try {\n        const { protocol, origin } = new URL(bundleUrl);\n        // e.g. http://localhost:8081\n        return protocol === 'http:' || protocol === 'https:' ? origin : null;\n    } catch  {\n        return null;\n    }\n} //# sourceMappingURL=getBundleOrigin.js.map\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHNzcikvLi9ub2RlX21vZHVsZXMvZXhwby9idWlsZC91dGlscy9nZXRCdW5kbGVPcmlnaW4uanMiLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUEsOERBQThEO0FBRWhCO0FBQ0E7QUFFOUM7Ozs7Ozs7O0NBUUMsR0FDTSxTQUFTQyxnQkFBZ0JDLFlBQVlGLDJEQUFBQSxFQUFjO0lBQ3hELElBQUksQ0FBQ0UsV0FBVztRQUNkLE9BQU87SUFDVDtJQUNBLElBQUk7UUFDRixNQUFNLEVBQUVDLFFBQVEsRUFBRUMsTUFBTSxFQUFFLEdBQUcsSUFBSUMsSUFBSUg7UUFDckMsNkJBQTZCO1FBQzdCLE9BQU9DLGFBQWEsV0FBV0EsYUFBYSxXQUFXQyxTQUFTO0lBQ2xFLEVBQUUsT0FBTTtRQUNOLE9BQU87SUFDVDtBQUNGIiwic291cmNlcyI6WyJ1dGlscy9nZXRCdW5kbGVPcmlnaW4udHMiXSwibmFtZXMiOlsiZ2V0QnVuZGxlVXJsIiwiZ2V0QnVuZGxlT3JpZ2luIiwiYnVuZGxlVXJsIiwicHJvdG9jb2wiLCJvcmlnaW4iLCJVUkwiXSwiaWdub3JlTGlzdCI6WzBdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///(ssr)/./node_modules/expo/build/utils/getBundleOrigin.js\n");

/***/ }),

/***/ "(ssr)/./node_modules/expo/build/utils/getBundleUrl.web.js":
/*!***********************************************************!*\
  !*** ./node_modules/expo/build/utils/getBundleUrl.web.js ***!
  \***********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   getBundleUrl: () => (/* binding */ getBundleUrl)\n/* harmony export */ });\n// Copyright 2015-present 650 Industries. All rights reserved.\n// `document.currentScript` is only set during synchronous script execution, so we capture its URL\n// at module load; reading it later (effect, async, dynamic import) would see `null`.\nconst initialScriptURL =  false ? 0 : null;\nfunction getBundleUrl() {\n    let scriptURL = initialScriptURL;\n    if (true) {\n        // For server runtime, we use the filename of the current script\n        scriptURL = 'file://' + __filename;\n    }\n    if (scriptURL == null) {\n        return null;\n    }\n    const url = new URL(scriptURL);\n    return `${url.protocol}//${url.host}${url.pathname}`;\n} //# sourceMappingURL=getBundleUrl.web.js.map\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHNzcikvLi9ub2RlX21vZHVsZXMvZXhwby9idWlsZC91dGlscy9nZXRCdW5kbGVVcmwud2ViLmpzIiwibWFwcGluZ3MiOiI7Ozs7QUFBQSw4REFBOEQ7QUFFOUQsa0dBQWtHO0FBQ2xHLHFGQUFxRjtBQUNyRixNQUFNQSxtQkFDSixNQUFrQixHQUFlRSxDQUE4Q0UsR0FBTTtBQUVoRixTQUFTQztJQUNkLElBQUlDLFlBQTJCTjtJQUUvQixJQUFJLElBQWtCLEVBQWE7UUFDakMsZ0VBQWdFO1FBQ2hFTSxZQUFZLFlBQVlDO0lBQzFCO0lBRUEsSUFBSUQsYUFBYSxNQUFNO1FBQ3JCLE9BQU87SUFDVDtJQUVBLE1BQU1FLE1BQU0sSUFBSUMsSUFBSUg7SUFDcEIsT0FBTyxHQUFHRSxJQUFJRSxRQUFRLENBQUMsRUFBRSxFQUFFRixJQUFJRyxJQUFJLEdBQUdILElBQUlJLFFBQVEsRUFBRTtBQUN0RCIsInNvdXJjZXMiOlsidXRpbHMvZ2V0QnVuZGxlVXJsLndlYi50cyJdLCJuYW1lcyI6WyJpbml0aWFsU2NyaXB0VVJMIiwid2luZG93IiwiZG9jdW1lbnQiLCJjdXJyZW50U2NyaXB0Iiwic3JjIiwiZ2V0QnVuZGxlVXJsIiwic2NyaXB0VVJMIiwiX19maWxlbmFtZSIsInVybCIsIlVSTCIsInByb3RvY29sIiwiaG9zdCIsInBhdGhuYW1lIl0sImlnbm9yZUxpc3QiOlswXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(ssr)/./node_modules/expo/build/utils/getBundleUrl.web.js\n");

/***/ })

};
;