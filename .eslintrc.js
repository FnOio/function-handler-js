module.exports = {
    root: true,
    extends: [
        'airbnb-base',
        'airbnb-typescript/base'
    ],
    parser: "@typescript-eslint/parser",
    parserOptions: { "project": ["./tsconfig.json"] },
    plugins: [
        "@typescript-eslint"
    ],
    rules: {
        "indent": ["error", 2],
        "max-line-length": [false, 0]
    }
};
