from json import load
import pandas as pd
from dataclasses import dataclass
from pathlib import Path
import unicodedata
import re


def slugify(value, allow_unicode=False):
    """
    Taken from https://github.com/django/django/blob/master/django/utils/text.py
    Convert to ASCII if 'allow_unicode' is False. Convert spaces or repeated
    dashes to single dashes. Remove characters that aren't alphanumerics,
    underscores, or hyphens. Convert to lowercase. Also strip leading and
    trailing whitespace, dashes, and underscores.
    """
    value = str(value)
    if allow_unicode:
        value = unicodedata.normalize("NFKC", value)
    else:
        value = (
            unicodedata.normalize("NFKD", value)
            .encode("ascii", "ignore")
            .decode("ascii")
        )
    value = re.sub(r"[^\w\s-]", "", value.lower())
    return re.sub(r"[^\S ]+", "-", value).strip("-_")


with open("challenges.json") as f:
    challenges_json = load(f)

with open("submissions.json") as f:
    submissions_json = load(f)


challenges = {}

for data in challenges_json["results"]:
    challenge = {}
    challenge["pretty_name"] = data["name"]
    challenge["description"] = data["description"]
    challenge["category"] = data["category"]
    challenge["attribution"] = data["attribution"]
    challenge["solves"] = 0
    challenges[data["id"]] = challenge


for submission_data in submissions_json["results"]:
    if submission_data["type"] == "correct":
        challenges[submission_data["challenge_id"]]["solves"] += 1

chal_df = pd.DataFrame.from_dict(challenges, "index")

chal_df = chal_df[chal_df.category != "КМБ (joy)"]
chal_df = chal_df.sort_values(["category", "solves"], ascending=False)


def save_to_file(path, text):
    if Path(path).exists():
        print(f"{path} exists")
        return
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(text, encoding="UTF-8")


category_map = {
    "Чеченские головоломки (crypto)": "crypto",
    "Разборка Жигули (reverse)": "reverse",
    "Пывн 404": "pwn",
    "Пентагон04ка (pentest)": "pentest",
    "Нам и не нужон интернет ваш (Web)": "web",
    "Маскировочные сети (stegano)": "stegano",
    "Карагандинские приколы (misc)": "misc",
    'Задания для отдела "К" (forensic)': "forensic",
    "osint": "osint",
}


index_df = chal_df.filter(["pretty_name", "attribution", "solves"])
index_df["writeup"] = chal_df.apply(
    lambda chal: f"[Не готов](./{category_map[chal.category]}/{slugify(chal.pretty_name, allow_unicode=True).replace(" ", "%20")}/README.md)",
    axis=1,
)
index_df = index_df.rename(
    columns={
        "pretty_name": "Таск",
        "attribution": "Автор",
        "solves": "Количество решений",
        "writeup": "Райтап",
    }
)
categories = chal_df["category"].unique()
index_repr = f"# Гойда CTF 2025\n\n" + "\n".join(
    f"\n### {category}\n{index_df[chal_df["category"] == category].to_markdown(index=False)}"
    for category in categories
)


chal_df["text"] = chal_df.apply(
    lambda chal: f"""# {chal.pretty_name}
**Категория:** {chal.category}\\
**Автор:** {chal.attribution}\\
**Количество решений:** {chal.solves}\\
**Категория:** {chal.category}

{chal.description}

### Решение
""",
    axis=1,
)

save_to_file("./README.md", index_repr)

chal_df.apply(
    lambda chal: save_to_file(
        f"./{category_map[chal.category]}/{slugify(chal.pretty_name, allow_unicode=True)}/README.md",
        chal.text,
    ),
    axis=1,
)
