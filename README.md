# Shopify-thems

Custom Shopify theme with an editorial storefront layer for lighting products.

## Useful Commands

```powershell
shopify.cmd theme check
shopify.cmd theme dev
```

Use `shopify.cmd` on Windows PowerShell if the `shopify` PowerShell wrapper is blocked by the local execution policy.

## Notes

- `assets/editorial.css` contains the shared editorial visual system.
- `snippets/editorial-chrome.liquid` owns the floating controls, scroll progress, reveal effects, and AJAX add-to-cart feedback.
- `sections/*-editorial.liquid` contains the custom storefront sections used by the JSON templates.
