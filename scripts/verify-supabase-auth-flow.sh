#!/usr/bin/env bash
# Creates two timestamped QA accounts to verify Supabase Auth, the profile trigger,
# role-specific RLS policies, and merchant/courier registration. It never prints passwords or tokens.
set -euo pipefail

# Do not rely on VITE_* here: terminal sessions may expose a redacted UI placeholder.
# These are public project settings already used by the browser client.
SUPABASE_URL="${SUPABASE_TEST_URL:-https://ojmitpxuhgyjuxlbbikf.supabase.co}"
SUPABASE_KEY="${SUPABASE_TEST_PUBLISHABLE_KEY:-sb_publishable_MzeAhcOpwKo78cbHyHy7XA_ehyAAL2i}"
RUN_ID="$(date +%s)"

json_value() {
  local json="$1"
  local key="$2"
  printf '%s' "$json" | tr -d '\n' | sed -n "s/.*\"${key}\":\"\([^\"]*\)\".*/\1/p" | head -n 1
}

signup() {
  local email="$1"
  local password="$2"
  local role="$3"
  local name="$4"
  curl --fail-with-body -sS -X POST "${SUPABASE_URL}/auth/v1/signup" \
    -H 'Content-Type: application/json' \
    -H "apikey: ${SUPABASE_KEY}" \
    -d "{\"email\":\"${email}\",\"password\":\"${password}\",\"data\":{\"role\":\"${role}\",\"name\":\"${name}\"}}"
}

login() {
  local email="$1"
  local password="$2"
  curl --fail-with-body -sS -X POST "${SUPABASE_URL}/auth/v1/token?grant_type=password" \
    -H 'Content-Type: application/json' \
    -H "apikey: ${SUPABASE_KEY}" \
    -d "{\"email\":\"${email}\",\"password\":\"${password}\"}"
}

read_profile() {
  local token="$1"
  curl --fail-with-body -sS "${SUPABASE_URL}/rest/v1/profiles?select=id,role,email&limit=1" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${token}"
}

logout() {
  local token="$1"
  curl --fail-with-body -sS -o /dev/null -X POST "${SUPABASE_URL}/auth/v1/logout" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${token}"
}

assert_role_and_profile() {
  local expected_role="$1"
  local token="$2"
  local profile
  profile="$(read_profile "${token}")"
  local profile_id
  profile_id="$(json_value "${profile}" id)"
  local profile_role
  profile_role="$(json_value "${profile}" role)"
  test -n "${profile_id}"
  test "${profile_role}" = "${expected_role}"
  printf '%s' "${profile_id}"
}

register_merchant() {
  local id="$1"
  local token="$2"
  curl --fail-with-body -sS -X POST "${SUPABASE_URL}/rest/v1/merchants" \
    -H 'Content-Type: application/json' \
    -H 'Prefer: return=representation' \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${token}" \
    -d "{\"id\":\"${id}\",\"store_name\":\"QA Merchant ${RUN_ID}\",\"wilaya\":\"Alger\",\"commune\":\"Alger Centre\",\"phone\":\"0550000001\",\"delivery_communes\":[\"Alger Centre\"],\"status\":\"pending_review\"}"
}

register_courier() {
  local id="$1"
  local token="$2"
  curl --fail-with-body -sS -X POST "${SUPABASE_URL}/rest/v1/couriers" \
    -H 'Content-Type: application/json' \
    -H 'Prefer: return=representation' \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${token}" \
    -d "{\"id\":\"${id}\",\"vehicle\":\"bicycle\",\"wilaya\":\"Alger\",\"communes\":[\"Alger Centre\"],\"availability\":[\"morning\"],\"store_mode\":\"all\",\"selected_store_ids\":[],\"status\":\"pending\"}"
}

MERCHANT_EMAIL="qa.merchant.${RUN_ID}@example.invalid"
COURIER_EMAIL="qa.courier.${RUN_ID}@example.invalid"
MERCHANT_PASSWORD="SouqMerchant-${RUN_ID}-Test"
COURIER_PASSWORD="SouqCourier-${RUN_ID}-Test"

signup "${MERCHANT_EMAIL}" "${MERCHANT_PASSWORD}" merchant "QA Merchant" >/dev/null
merchant_login="$(login "${MERCHANT_EMAIL}" "${MERCHANT_PASSWORD}")"
merchant_token="$(json_value "${merchant_login}" access_token)"
test -n "${merchant_token}"
merchant_id="$(assert_role_and_profile merchant "${merchant_token}")"
merchant_record="$(register_merchant "${merchant_id}" "${merchant_token}")"
test "$(json_value "${merchant_record}" id)" = "${merchant_id}"
test "$(json_value "${merchant_record}" status)" = "pending_review"
logout "${merchant_token}"

signup "${COURIER_EMAIL}" "${COURIER_PASSWORD}" courier "QA Courier" >/dev/null
courier_login="$(login "${COURIER_EMAIL}" "${COURIER_PASSWORD}")"
courier_token="$(json_value "${courier_login}" access_token)"
test -n "${courier_token}"
courier_id="$(assert_role_and_profile courier "${courier_token}")"
courier_record="$(register_courier "${courier_id}" "${courier_token}")"
test "$(json_value "${courier_record}" id)" = "${courier_id}"
test "$(json_value "${courier_record}" status)" = "pending"
logout "${courier_token}"

printf 'PASS: merchant and courier signup, sign-in, profile trigger, role checks, and protected registration succeeded.\n'
printf 'QA accounts: %s ; %s\n' "${MERCHANT_EMAIL}" "${COURIER_EMAIL}"
