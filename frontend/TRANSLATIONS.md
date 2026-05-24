# UI translations (i18n)

All user-visible strings live in a single file:

**`src/contexts/LanguageContext.js`** — objects `T.pl` (Polish) and `T.en` (English).

## How to edit copy

1. Open `LanguageContext.js`.
2. Find the **key** (e.g. `import_review_hint_pre`) in both `pl` and `en` sections.
3. Update the value in both languages.
4. Save — hot reload will refresh the frontend.

In components, text is loaded via the hook:

```javascript
const { t, lang } = useLanguage();
t('key')                 // plain string
t('products_deleted')(3) // function with a parameter
```

**UI language** is set by the 🇬🇧/🇵🇱 flags on the login screen (stored in localStorage as `lang`).  
**Account language** (default products/recipes in the database) — **Account → ACCOUNT LANGUAGE** in the profile modal.

### Internal ids vs i18n keys (Expenses)

Fixed-cost and drink **tiles** use Polish ids internally (`czynsz`, `kawa`, …) because they are stored in `localStorage`.  
Translation keys in `LanguageContext.js` are **English** (`exp_rent`, `drink_coffee`, …).

The mapping lives in **`src/i18n/expenseKeys.js`**:

| Internal id (localStorage) | i18n key |
|---------------------------|----------|
| `czynsz` | `exp_rent` |
| `prad` | `exp_electricity` |
| `zwierze` | `exp_pet` |
| `kawa` | `drink_coffee` |
| … | (see file for full list) |

In code: `t(expenseI18nKey('czynsz'))` → `"Rent"` / `"Czynsz"`.

---

## Key map → where it appears on the page

### Global (all tabs)

| Key | Where on the page |
|-----|-------------------|
| `loading` | Full-screen loader on startup |
| `cancel` | “Cancel” button in the confirmation modal (ToastContext) |
| `btn_delete` | Default “Delete” button in the confirmation modal |
| `current_profile` | Label above the profile selector in the sidebar |
| `member_added`, `member_renamed`, `member_deleted` | Toast after adding / renaming / removing a household member |
| `member_delete_title`, `member_delete_confirm` | Delete-profile modal (sidebar) |
| `member_switch_hint` | Tooltip on a profile name in the dropdown |
| `member_name_ph`, `member_add_person`, `add_btn` | “Add person” form in the sidebar |
| `tab_macro`, `tab_calendar`, … | Sidebar tab labels |
| `logout`, `account` | Buttons at the bottom of the sidebar |

### Login (`Login.js`)

| Key | Where on the page |
|-----|-------------------|
| `subtitle_login` | Below the ONTRACK logo |
| `login_username_ph`, `login_password_ph` | Username/password form |
| `login_submit`, `login_register_submit` | Sign in / Create account buttons |
| `login_switch_register`, `login_switch_login` | Toggle between sign-in and sign-up |
| `login_or` | Divider before Google button |
| `google_btn` | Google sign-in button |
| `login_privacy_prefix`, `login_privacy_link`, `login_privacy_suffix` | Footer — privacy policy acceptance |

### Account / Profile (`Profile.js`)

| Key | Where on the page |
|-----|-------------------|
| `my_profile`, `delete_account`, `delete_confirm` | Profile modal |
| `account_language`, `profile_lang_desc` | Account language section |
| `profile_lang_name_pl`, `profile_lang_name_en` | 🇵🇱 / 🇬🇧 language buttons |
| `profile_lang_change_title`, `profile_lang_warning_*`, `profile_lang_change_confirm` | Warning modal when changing account language |
| `show_tutorial`, `close`, `deleting` | Modal action buttons |

### Macro Calculator (`MacroCalculator.js`)

| Key | Where on the page |
|-----|-------------------|
| `macro_your_data`, `macro_gender`, `macro_age`, … | Left-hand form |
| `placeholder_eg_age`, `placeholder_eg_weight`, `placeholder_eg_height` | Field placeholders (e.g. 28) |
| `fill_left` | Message when chart data is missing |
| `macro_goals_saved` | Toast after saving goals |
| `macro_save_goal`, `macro_daily_goal`, … | Right column — goals and legend |

### Meal Planner (`Calendar.js`)

| Key | Where on the page |
|-----|-------------------|
| `how_to_title`, `ht_meals_*`, `ht_copy_*`, `ht_tpl_*`, `ht_macro_*` | Expandable help section at the top |
| `slot_labels`, `day_short`, `day_full`, `month_names` | Day headers, meal slots |
| `btn_copy`, `btn_paste`, `btn_delete`, `btn_grab` | Day / week action buttons |
| `confirm_del_day`, `confirm_del_week` | Delete day / week confirmation modals |
| `macro_day_label` | “Macro” label under slots (today, no meals yet) |
| `recipes_count` | Recipe count when the carousel is collapsed |
| `cal_no_recipes_match` | No-results message when searching recipes |
| `click_edit_macro` | Macro tooltip on an ingredient in recipe preview |
| `est_cost`, `currency` | Price on a recipe card in the carousel |
| `edit_btn` | “Edit” button on a saved template |
| `tpl_title`, `save_tpl`, `apply`, … | Weekly template editor |

### Recipes (`Recipes.js`)

| Key | Where on the page |
|-----|-------------------|
| `add_recipe_title`, `how_to_recipe`, `fmt_*`, `ai_tip` | Add-recipe section (top) |
| `recipe_ph`, `parse_ai_btn`, `parse_regex_btn` | Textarea and parse buttons |
| `recipe_servings_label`, `recipe_servings_hint` | “Recipe Servings” field |
| `recipe_list_title`, `search_recipe_ph` | Recipe list (bottom) |
| `recipe_not_found`, `shown_recipes` | No results / list pagination |
| `click_to_edit`, `click_change_meal`, `loading_ing` | Tooltips and ingredient loading state |
| `confirm_del_recipe`, `del_selected_recipes`, … | Recipe deletion |

### Products (`Products.js`)

| Key | Where on the page |
|-----|-------------------|
| `add_product_title`, `product_name_lbl`, `macro_auto_*` | Manual add form (top left) |
| `search_products_hint` | “Looking for products?” section (store links) |
| `import_title`, `import_how_to`, `opt1_*`, `opt2_*` | Receipt / CSV / TXT import |
| `import_review_hint_pre/suf`, `create_new_product_*` | **Import review** — instructions and dropdown |
| `no_assignment_hint`, `import_new_product_hint_suf` | Hint for a new product from a receipt |
| `price_per_pkg_suffix`, `weight_btn` | Price labels (/ pkg vs / kg) |
| `apply_changes`, `import_updated_n`, `import_added_n`, `import_done_suffix` | Buttons and success toast after import |
| `product_list_title`, `search_product_ph` | Product table (bottom) |
| `confirm_del_*`, `products_deleted`, `product_not_found`, `shown_products` | Delete confirmations and search |

### Expenses (`Summary.js`, `DrinksCard.js`)

| Key | Where on the page |
|-----|-------------------|
| `summary_title`, `this_week`, `this_month`, `custom_period` | Header and date range |
| `drinks_period_week/month/custom` | Period label in the drinks section |
| `exp_rent`, `exp_electricity`, `exp_pet`, … | Fixed-cost tiles (see `src/i18n/expenseKeys.js` for id → key map) |
| `drink_coffee`, `drink_tea`, `dc_*` | Expanded drink / laundry / hygiene forms |
| `eg_prefix` | “e.g.” / “np.” placeholders |
| `food_expenses_label`, `expenses_total` | Food expenses table |

### Export (`Export.js`)

| Key | Where on the page |
|-----|-------------------|
| `export_generate_title`, `export_btn_*` | Document generation buttons |
| `date_format_ph` | Date placeholder (dd/mm/yyyy) |
| `export_help_summary`, `export_help_macro`, … | “How does export work?” help card (bottom) |
| `week_preview`, `days_with_meals`, `export_no_meals` | Week preview (right column) |

> **Note:** Generated HTML/PDF for printing in `Export.js` uses separate strings with a `lang` parameter — those are print documents, not live UI.

### Privacy policy

Legal copy lives in **`PrivacyPolicy.js`** (separate `pl` / `en` content objects), not in `LanguageContext`.

---

## Finding a key quickly

In VS Code / Cursor: `Ctrl+Shift+F` → search for a fragment of the Polish or English text inside `LanguageContext.js`.

Or search for `t('` in a component — each key maps to an entry in the tables above.

## Adding new copy

1. Add the key to both `T.pl` and `T.en` in `LanguageContext.js` (with a section comment, e.g. `// Products`).
2. In the component: `t('new_key')`.
3. Optionally add a row to this file for future reference.
