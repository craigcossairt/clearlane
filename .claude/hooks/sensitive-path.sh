# Sourced, never run: the sensitive-file check with bash builtins only.
#
# Why no spawns: on the Windows build PC every process spawn costs about 1.5s, and Cursor's
# pre-edit hook fails CLOSED at 10s. The old check spawned about ten processes (dirname, cat,
# mktemp, a nested bash, jq, grep) and took about 15s, which blocked every edit. Keep this file
# free of $(...), pipes and external commands.
#
# Used by bin/run-claude-hook.sh (Cursor, Grok). Claude Code still runs block-sensitive-files.sh,
# which holds the same patterns; tools/hooks.test.ts fails if the two lists drift apart.

# Sets HOOK_PATH to the target file in the JSON payload $1, or "" when there is none.
# Claude Code nests tool_input.file_path, Grok toolInput.filePath, Cursor a top-level file_path;
# the first file_path or filePath in the text covers all three. "path" is the last resort.
hook_path_from_payload() {
  HOOK_PATH=""
  local re_file='"(file_path|filePath)"[[:space:]]*:[[:space:]]*"([^"]*)"'
  local re_path='"path"[[:space:]]*:[[:space:]]*"([^"]*)"'
  if [[ $1 =~ $re_file ]]; then
    HOOK_PATH=${BASH_REMATCH[2]}
  elif [[ $1 =~ $re_path ]]; then
    HOOK_PATH=${BASH_REMATCH[1]}
  fi
}

# Returns 0 and sets SENSITIVE_REASON when the payload $1 must not be edited without the user.
# Fails CLOSED: a payload with no parsable path is blocked.
sensitive_reason() {
  SENSITIVE_REASON=""
  [ -n "$1" ] || return 1
  hook_path_from_payload "$1"
  if [ -z "$HOOK_PATH" ]; then
    SENSITIVE_REASON='BLOCKED: could not parse the target file path from the hook payload, so the sensitive-file check could not run. Confirm with the user before editing.'
    return 0
  fi
  local templates='\.(example|sample|template)$'
  local secrets='\.env($|\.)|secrets|credentials|\.pem$|\.key$|github_pat|id_rsa|id_ed25519'
  local locks='package-lock\.json$|pubspec\.lock$|yarn\.lock$|bun\.lock|Cargo\.lock$|poetry\.lock$|composer\.lock$'
  local generated='\.generated\.|\.min\.(js|css)$'
  local all="$secrets|$locks|$generated" was_nocase=0 hit=1
  shopt -q nocasematch && was_nocase=1
  shopt -s nocasematch
  # Templates for secrets files are fine to edit (.env.example, config.sample, ...)
  if ! [[ $HOOK_PATH =~ $templates ]] && [[ $HOOK_PATH =~ $all ]]; then
    hit=0
    SENSITIVE_REASON='BLOCKED: This is a sensitive, lock, or generated file. Confirm with the user before editing.'
  fi
  [ "$was_nocase" = 1 ] || shopt -u nocasematch
  return $hit
}
