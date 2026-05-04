import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";
import reactPlugin from "eslint-plugin-react";

export default tseslint.config(
  {
    ignores: [
      "dist/",
      "dist-electron/",
      "build/",
      "node_modules/",
      "Space-Saver-Builds/",
      ".github/",
      "assets/",
      "bin/",
      "functions/",
      "firebase/",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      react: reactPlugin,
    },
    settings: {
      react: { version: "detect" },
    },
    rules: {
      // Stricter baseline definitions
      "@typescript-eslint/no-require-imports": "error",
      "no-useless-assignment": "error",
      "no-empty": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],

      // Practical overrides: these are set to "warn" because sometimes their usage
      // is inevitable (e.g. interacting with poorly typed external dependencies or
      // printing temporary debug statements), but they shouldn't pass entirely clean.
      "no-console": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/ban-ts-comment": "warn",

      ...reactPlugin.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",
    },
  },
  {
    files: [
      "scripts/**/*.js",
      "scripts/**/*.mjs",
      "src/main/**/*.ts",
      "eslint.config.mjs",
    ],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: [
      "src/renderer/**/*.{ts,tsx}",
      "website/**/*.js",
      "vite.config.ts",
      "vitest.setup.ts",
    ],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
);
