from pathlib import Path

from tests.contract.contract_registry import CONTRACT_COVERAGE, CONTRACT_IDS

CONTRACT_DIR = Path(__file__).parent


def test_contract_registry_is_complete():
    assert set(CONTRACT_COVERAGE) == set(CONTRACT_IDS)


def test_contract_modules_exist():
    for endpoint_id, modules in CONTRACT_COVERAGE.items():
        for module in modules:
            path = CONTRACT_DIR / module
            assert path.is_file(), f"{endpoint_id} references missing module {module}"
