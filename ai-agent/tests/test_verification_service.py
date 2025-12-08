import pytest
from unittest.mock import MagicMock, patch, mock_open
import os
import sys
import verification_service
import json
import subprocess

# Add the ai-agent directory to the path to allow imports
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


# Mock configuration value for MINIMUM_COVERAGE_PERCENTAGE
@pytest.fixture(autouse=True)
def mock_config():
    with patch("config.MINIMUM_COVERAGE_PERCENTAGE", 90):
        yield


@pytest.fixture
def mock_work_directory(tmp_path):
    # Create a dummy work directory and a dummy file inside it
    dummy_dir = tmp_path / "work_dir"
    dummy_dir.mkdir()
    dummy_file = dummy_dir / "app.py"
    dummy_file.write_text("print('hello')")
    return str(dummy_dir)


def test_verify_code_coverage_success(mock_work_directory):
    # Mock subprocess.run for a successful pytest execution
    mock_result = MagicMock()
    mock_result.stdout = "Pytest run successfully"
    mock_result.stderr = ""
    # Set check=True behavior for subprocess.run
    mock_result.returncode = 0
    with patch("subprocess.run", return_value=mock_result) as mock_subprocess_run:
        # Mock the coverage.json file content
        coverage_data = {"totals": {"percent_covered": 95.0}}
        with patch("builtins.open", mock_open(read_data=json.dumps(coverage_data))):
            with patch(
                "os.path.exists", return_value=True
            ):  # Ensure coverage.json is found
                result = verification_service.verify_code_coverage(mock_work_directory)
                assert result is True
                # Verify that subprocess.run was called with the correct arguments
                expected_command = [
                    "pytest",
                    "--cov=.",
                    f"--cov-report=json:{os.path.join(mock_work_directory, 'coverage.json')}",
                    mock_work_directory,
                ]
                mock_subprocess_run.assert_called_once_with(
                    expected_command, capture_output=True, text=True, check=True
                )


def test_verify_code_coverage_failure_percentage_low(mock_work_directory):
    mock_result = MagicMock()
    mock_result.stdout = "Pytest run successfully"
    mock_result.stderr = ""
    mock_result.returncode = 0
    with patch("subprocess.run", return_value=mock_result):
        coverage_data = {"totals": {"percent_covered": 80.0}}  # Lower than 90%
        with patch("builtins.open", mock_open(read_data=json.dumps(coverage_data))):
            with patch("os.path.exists", return_value=True):
                result = verification_service.verify_code_coverage(mock_work_directory)
                assert result is False


def test_verify_code_coverage_pytest_command_not_found(mock_work_directory):
    with patch("subprocess.run", side_effect=FileNotFoundError):
        result = verification_service.verify_code_coverage(mock_work_directory)
        assert result is False


def test_verify_code_coverage_pytest_called_process_error(mock_work_directory):
    mock_error = subprocess.CalledProcessError(1, ["pytest"])
    mock_error.stdout = ""
    mock_error.stderr = "Error during pytest"
    with patch("subprocess.run", side_effect=mock_error):
        result = verification_service.verify_code_coverage(mock_work_directory)
        assert result is False


def test_verify_code_coverage_no_coverage_report(mock_work_directory):
    mock_result = MagicMock()
    mock_result.stdout = "Pytest run successfully"
    mock_result.stderr = ""
    mock_result.returncode = 0
    with patch("subprocess.run", return_value=mock_result):
        with patch("os.path.exists", return_value=False):  # coverage.json not found
            result = verification_service.verify_code_coverage(mock_work_directory)
            assert result is False


def test_verify_code_coverage_invalid_json(mock_work_directory):
    mock_result = MagicMock()
    mock_result.stdout = "Pytest run successfully"
    mock_result.stderr = ""
    mock_result.returncode = 0
    with patch("subprocess.run", return_value=mock_result):
        with patch("builtins.open", mock_open(read_data="invalid json")):
            with patch("os.path.exists", return_value=True):
                result = verification_service.verify_code_coverage(mock_work_directory)
                assert result is False


def test_verify_code_coverage_missing_totals_in_json(mock_work_directory):
    mock_result = MagicMock()
    mock_result.stdout = "Pytest run successfully"
    mock_result.stderr = ""
    mock_result.returncode = 0
    with patch("subprocess.run", return_value=mock_result):
        coverage_data = {"files": {}}  # Missing "totals" key
        with patch("builtins.open", mock_open(read_data=json.dumps(coverage_data))):
            with patch("os.path.exists", return_value=True):
                result = verification_service.verify_code_coverage(mock_work_directory)
                assert result is False
