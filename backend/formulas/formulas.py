from sympy import symbols, latex, Function, Rational

w, w0, w1, rho_i = symbols(r'w w_0 w_1 \rho_i')
p_fill, alpha = symbols(r'p_{\text{fill}} \alpha')
omega_i, m_bar = symbols(r'\omega_i \bar{m}_t')
alpha_i, b_i, eps_i = symbols(r'\alpha_i b_i \varepsilon_i')

FORMULAS = {
    "crra_utility": {
        "expr": w ** (1 - rho_i) / (1 - rho_i),
        "description": "Universal CRRA utility function",
    },
    "eu_scoring": {
        "latex": r"\mathrm{EU}(\alpha) = p_{\text{fill}} \cdot U(w_1) + (1 - p_{\text{fill}}) \cdot U(w_0)",
        "description": "Expected-utility scoring for action selection",
    },
    "belief_update_plan1": {
        "latex": r"V_{i,t}^{\text{post}} = \omega_i \cdot V_{i,t}^{\text{prior}} + (1 - \omega_i) \cdot \bar{m}_t",
        "description": "Plan I algorithmic posterior",
    },
    "prior_formation": {
        "latex": (
            r"V_{i,t}^{\text{prior}} = \max\!\bigl(0,\; "
            r"[\alpha_i \cdot \widetilde{\mathrm{FV}}_{i,t} + (1-\alpha_i) \cdot H_{i,t}]"
            r"(1 + b_i) + \varepsilon_i\bigr)"
        ),
        "description": "v3 §2 prior decomposition",
    },
    "mispricing_nd": {
        "latex": r"\mathrm{ND} = \frac{\sum_j |p_j - \mathrm{FV}_{t(j)}| \cdot q_j}{Q}",
        "description": "Normalized absolute price deviation",
    },
    "haessel_r2": {
        "latex": (
            r"R^2_{\text{Haessel}} = 1 - "
            r"\frac{\sum_t (\bar{p}_t - \mathrm{FV}_t)^2}{\sum_t (\bar{p}_t - \bar{\bar{p}})^2}"
        ),
        "description": "Goodness-of-fit of mean price to fundamental",
    },
}


def get_formula(formula_id: str) -> dict | None:
    f = FORMULAS.get(formula_id)
    if f is None:
        return None
    if "expr" in f:
        return {"id": formula_id, "latex": latex(f["expr"]), "description": f["description"]}
    return {"id": formula_id, "latex": f["latex"], "description": f["description"]}


def get_all_formulas() -> list[dict]:
    return [get_formula(fid) for fid in FORMULAS]
