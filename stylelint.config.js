export default {
  extends: ['stylelint-config-gds/scss'],
  ignoreFiles: ['**/public/**', '**/package/**', '**/vendor/**'],
  rules: {
    'declaration-no-important': null // Allow !important in utility classes
  }
}
