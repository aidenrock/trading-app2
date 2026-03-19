def check_trade():
    print("\n=== SHOULD I TAKE THIS TRADE? (STRICT MODE) ===\n")

    time_str = input("Time (HH:MM): ").strip()

    def ask_yes_no(prompt: str) -> bool:
        raw = input(prompt).strip().lower()
        return raw in {"y", "yes"}

    # Required strict yes/no inputs
    htf = ask_yes_no("HTF Sweep? (y/n): ")
    conf1 = ask_yes_no("1m Confirmation? (y/n): ")
    liquidity = ask_yes_no("Clear draw on liquidity? (y/n): ")

    allowed_conf5 = {"79%"}  # user: "79% only"
    allowed_cont5 = {"FVG", "EQ", "SMT"}

    def pick_type(prompt: str, allowed_canon: set[str], none_values={"none", "n", "no", ""}) -> str | None:
        raw = input(prompt).strip().lower()
        norm = raw.replace(" ", "")

        if norm in none_values:
            return None

        # Normalize 79% variants into exactly "79%" (and reject anything else).
        if allowed_canon == {"79%"}:
            if norm in {"79%", "79", "79pct", "79percent", "79pct%"}:
                return "79%"
            return None

        # For other types, accept exact canonical matches after normalization.
        for canon in allowed_canon:
            if norm == canon.lower().replace(" ", ""):
                return canon

        return None

    conf5 = pick_type("5m Confirmation type (must be 79% or none): ", allowed_conf5)
    cont5 = pick_type("5m Continuation type (FVG/EQ/SMT or none): ", allowed_cont5)

    errors: list[str] = []

    # Time rule
    try:
        hour, minute = map(int, time_str.split(":"))
        if hour == 9 and 30 <= minute < 50:
            errors.append("❌ No trading during 9:30–9:50 (manipulation window)")
    except ValueError:
        errors.append("❌ Invalid time format (use HH:MM)")

    # Strict rules (must be satisfied)
    if not htf:
        errors.append("❌ No HTF liquidity sweep")
    if conf5 != "79%":
        errors.append("❌ No valid 5m confirmation (79% only)")
    if cont5 is None:
        errors.append("❌ No valid 5m continuation type (FVG/EQ/SMT)")
    if not conf1:
        errors.append("❌ No 1m confirmation")
    if not liquidity:
        errors.append("❌ No clear draw on liquidity")

    print("\n--- RESULT ---")
    if errors:
        print("\n🚫 TRADE BLOCKED\n")
        for e in errors:
            print(e)
    else:
        print("\n✅ TRADE ALLOWED — A+ SETUP\n")

check_trade()
