import subprocess
import json
import os
import config


def verify_code_coverage(work_directory_path: str) -> bool:
    """
    Runs pytest with coverage in the given directory and verifies if
    the code coverage meets the minimum required percentage.
    Returns True if coverage is met, False otherwise.
    """
    coverage_report_path = os.path.join(work_directory_path, "coverage.json")

    try:
        # Navigate to the work directory and run pytest with coverage report in JSON format
        # This assumes a Python project with pytest tests in the work_directory_path
        command = [
            "pytest",
            "--cov=.",  # Measure coverage for the current directory
            f"--cov-report=json:{coverage_report_path}",
            work_directory_path,  # Specify the directory to run tests in
        ]

        # Using subprocess.run with check=True will raise CalledProcessError if the command fails
        result = subprocess.run(command, capture_output=True, text=True, check=True)
        print(f"Pytest stdout:\n{result.stdout}")
        print(f"Pytest stderr:\n{result.stderr}")

        if not os.path.exists(coverage_report_path):
            print(f"Error: coverage.json not found at {coverage_report_path}")
            return False

        with open(coverage_report_path, "r") as f:
            coverage_data = json.load(f)

        # Extract the total coverage percentage.
        # The structure of coverage.json can vary slightly, common key for total percentage is "totals" -> "percent_covered"
        total_percentage = coverage_data.get("totals", {}).get("percent_covered", 0)

        print(
            f"Code coverage: {total_percentage:.2f}% (Minimum required: {config.MINIMUM_COVERAGE_PERCENTAGE}%)"
        )

        return total_percentage >= config.MINIMUM_COVERAGE_PERCENTAGE

    except subprocess.CalledProcessError as e:
        print(f"Error running pytest for coverage: {e}")
        print(f"Stdout: {e.stdout}")
        print(f"Stderr: {e.stderr}")
        return False
    except FileNotFoundError:
        print(
            f"Error: pytest command not found. Ensure pytest is installed in the environment."  # noqa: F541
        )
        return False
    except json.JSONDecodeError:
        print(f"Error: Could not decode coverage.json from {coverage_report_path}")
        return False
    except Exception as e:
        print(f"An unexpected error occurred during coverage verification: {e}")
        return False
