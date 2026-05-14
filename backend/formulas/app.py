from fastapi import FastAPI, HTTPException
from formulas import get_formula, get_all_formulas

app = FastAPI(title="SymPy Formula Service")


@app.get("/formulas")
def list_formulas():
    return get_all_formulas()


@app.get("/formulas/{formula_id}")
def read_formula(formula_id: str):
    result = get_formula(formula_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Formula not found")
    return result


@app.get("/health")
def health():
    return {"status": "ok"}
