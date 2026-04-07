#!/bin/bash
eval "$(/opt/homebrew/bin/brew shellenv bash)"
npx serve public -l 5000 --no-clipboard
