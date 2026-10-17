"""
Shared fal.ai plumbing for the logo-creator scripts.

Standard library only, so the scripts run on a fresh machine with no pip
install. Every model call goes through fal's synchronous endpoint
(https://fal.run/<model>), which returns the result in the response.

The key is read from FAL_API_KEY (the name the dallaspeters.com repo uses) or
FAL_KEY (the name fal's own SDKs use). If neither is set in the environment,
the nearest .env*.local file walking up from the current directory is checked,
so running from inside the repo just works.
"""

import base64
import json
import mimetypes
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

KEY_NAMES = ("FAL_API_KEY", "FAL_KEY")
ENV_FILES = (".env.development.local", ".env.local", ".env")


def _key_from_env_files():
    here = Path.cwd().resolve()
    for folder in (here, *here.parents):
        for name in ENV_FILES:
            env_file = folder / name
            if not env_file.is_file():
                continue
            for line in env_file.read_text(errors="ignore").splitlines():
                line = line.strip()
                for key_name in KEY_NAMES:
                    if line.startswith(f"{key_name}="):
                        value = line.split("=", 1)[1].strip().strip('"').strip("'")
                        if value:
                            return value
    return None


def api_key():
    for key_name in KEY_NAMES:
        value = os.environ.get(key_name)
        if value:
            return value
    value = _key_from_env_files()
    if value:
        return value
    sys.exit(
        "No fal key found. Set FAL_API_KEY (or FAL_KEY), or run from inside a "
        "folder whose .env.development.local defines it."
    )


def call(model, payload, timeout=600):
    """POST to a fal model and return the parsed JSON result."""
    request = urllib.request.Request(
        f"https://fal.run/{model}",
        data=json.dumps(payload).encode(),
        headers={
            "Authorization": f"Key {api_key()}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        detail = error.read().decode(errors="ignore")[:500]
        sys.exit(f"{model} failed ({error.code}): {detail}")


def data_uri(path):
    """A local file as a data URI, which fal accepts anywhere it takes a URL."""
    path = Path(path)
    mime = mimetypes.guess_type(path.name)[0] or "image/png"
    encoded = base64.b64encode(path.read_bytes()).decode()
    return f"data:{mime};base64,{encoded}"


def download(url, out_path):
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    if url.startswith("data:"):
        out_path.write_bytes(base64.b64decode(url.split(",", 1)[1]))
    else:
        with urllib.request.urlopen(url, timeout=300) as response:
            out_path.write_bytes(response.read())
    return out_path
