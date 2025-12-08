import json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import blockchain_service
import ipfs_service
import config
import google.generativeai as genai

# --- Mock Data Toggle ---
USE_MOCK_ANALYZE_INPUT = (
    False  # Set to True to use mock AI response for /analyze-job-work-input
)

# =================================================================
# FastAPI App Initialization
# =================================================================

app = FastAPI(
    title="Verifi AI Agent",
    description="An off-chain agent for verifying job feasibility, processing work, and arbitrating disputes.",
    version="1.0.0",
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins for local development
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# =================================================================
# Pydantic Models for API
# =================================================================


class JobDetails(BaseModel):
    title: str
    description: str
    price: float
    duration: int
    duration_unit: str  # e.g., "Minggu", "Bulan"


class FreelancerProfile(BaseModel):
    skills: list[str]
    experience: str


class JobFitRequest(BaseModel):
    jobId: int
    freelancerProfile: FreelancerProfile
    bidProposal: str  # Added bid proposal for context


class SingleChainPaymentRequest(BaseModel):
    jobId: int
    clientAddress: str  # Client's address who initiated the payment
    tokenAddress: str  # Address of the ERC-20 token (e.g., USDC)
    amountToken: float  # Amount of ERC-20 token to use for payment (as float for input)


# =================================================================
# API Endpoints
# =================================================================


@app.post("/check-job-feasibility")
async def check_job_feasibility(job_details: JobDetails):
    """
    Analyzes the job details using Gemini AI to determine if it's feasible.
    """
    print(f"Received real AI feasibility check for: {job_details.title}")

    # Construct the prompt for the Gemini model
    prompt = f"""
        You are an expert technical project manager. Analyze the following job posting from a freelance platform to determine if it is feasible and reasonable.

        Job Details:
        - Title: "{job_details.title}"
        - Description: "{job_details.description}"
        - Offered Price: {job_details.price} AVAX
        - Duration: {job_details.duration} {job_details.duration_unit}

        Your analysis must consider:
        1. Clarity: Is the title and description clear and specific enough for a freelancer to understand the scope?
        2. Price Reasonableness: Is the price of {job_details.price} AVAX realistic for the work?
        3. Duration Adequacy: Is the duration sufficient to complete the task?
        4. Overall Feasibility: Is this a real, achievable software task, or is it spam, nonsensical, or impossible?

        Based on your analysis, you must provide a JSON response with the following structure:
        {{
          "feasible": <boolean>,
          "reason": "<string>",
          "price_recommendation": {{
            "is_reasonable": <boolean>,
            "recommendation_text": "<string>"
          }}
        }}

        - "feasible": Overall feasibility of the job.
        - "reason": A concise explanation for the overall feasibility.
        - "price_recommendation.is_reasonable": Specifically, is the offered price reasonable?
        - "price_recommendation.recommendation_text": If the price is unreasonable, suggest a fair price range (e.g., "A fair price for this job is between 1.5 - 2.5 AVAX."). If it is reasonable, simply state that (e.g., "The offered price seems reasonable.").

        Your entire response, including the 'reason' and 'recommendation_text', must be in English.
        Return ONLY the JSON object.
    """

    try:
        # Call the Gemini model helper function
        ai_response = await call_gemini_model(prompt, parse_json=True)

        if ai_response and "feasible" in ai_response and "reason" in ai_response:
            return ai_response
        else:
            # Handle cases where the AI response is not in the expected format
            raise HTTPException(
                status_code=500,
                detail={
                    "feasible": False,
                    "reason": "Failed to get a valid analysis from AI. Please try again.",
                },
            )
    except Exception as e:
        print(f"Error during AI feasibility check: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"An internal error occurred during AI analysis: {str(e)}",
        )


@app.post("/evaluate-job-fit")
async def evaluate_job_fit(request: JobFitRequest):
    """
    Analyzes how well a freelancer's profile and proposal fit a job using Gemini AI, with a strong focus on the proposal's quality.
    """
    print(f"Received real AI job fit evaluation for Job ID: {request.jobId}")

    try:
        # 1. Fetch job details from the blockchain
        job_details_from_chain = blockchain_service.get_job_details(request.jobId)
        if not job_details_from_chain or not job_details_from_chain.get(
            "descriptionIPFSHash"
        ):
            raise HTTPException(
                status_code=404, detail="Job details not found on the blockchain."
            )

        # 2. Fetch the job description from IPFS
        job_description_text = ipfs_service.get_file_content_from_ipfs(
            job_details_from_chain["descriptionIPFSHash"]
        )
        if not job_description_text:
            raise HTTPException(
                status_code=404, detail="Failed to fetch job description from IPFS."
            )

        # 3. Construct the new, more detailed prompt for Gemini
        prompt = f"""
            You are a senior technical lead evaluating a freelancer's application for a specific project. Your primary goal is to determine if their *proposal* shows they have understood the project, while using their *profile* as supporting evidence.

            **Project Requirements:**
            ---
            {job_description_text}
            ---

            **Freelancer's Proposal for THIS Project:**
            ---
            "{request.bidProposal}"
            ---

            **Supporting Evidence (Freelancer's General Profile):**
            - Skills: {', '.join(request.freelancerProfile.skills)}
            - Experience: {request.freelancerProfile.experience}

            **Your Evaluation Task:**
            You must score the freelancer's application from 1-10 based on the following weighted criteria:
            - **Proposal Quality (70% of score):** How well does the proposal address the specific project requirements? Does it show genuine understanding, or is it a generic, copy-pasted response? A high score requires the proposal to reference details from the project requirements.
            - **Profile Match (30% of score):** Do the skills and experience in their profile support their claims in the proposal and align with the project requirements?

            **CRITICAL:** A generic proposal that could apply to any job must not receive a high score, even if the freelancer's profile is strong. The score must reflect the quality of the proposal for *this specific job*.

            **Your Output:**
            Provide a JSON response with two keys, in English:
            - "match_score": An integer from 1 to 10.
            - "reason": A concise, one-sentence explanation justifying your score, focusing on the quality of the proposal.

            Return ONLY the JSON object.
        """

        # 4. Call the Gemini model
        ai_response = await call_gemini_model(prompt, parse_json=True)

        if ai_response and "match_score" in ai_response and "reason" in ai_response:
            return ai_response
        else:
            raise HTTPException(
                status_code=500, detail="Failed to get a valid analysis from AI."
            )

    except Exception as e:
        print(f"Error during job fit evaluation: {e}")
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=500, detail=f"An internal error occurred: {str(e)}"
        )


@app.get("/freelancer-profile/{address}")
async def get_freelancer_profile(address: str):
    """
    Returns a mock freelancer profile for a given address.
    This is a placeholder for actual profile fetching.
    """
    # Example mock profiles - in a real app, this would come from a database or IPFS
    MOCK_PROFILES = {
        "0xB9F17DEadBa7257f7ab0EF92df1c7A8799333f4E": FreelancerProfile(
            skills=[
                "Python",
                "Data Science",
                "Machine Learning",
                "FastAPI",
                "Solidity (Basic)",
            ],
            experience="8 years in data analysis and backend development, 2 years in Web3 prototyping. Delivered 10+ projects.",
        ),
        "0x71d6208666c17b2AfBfF9A17354292513536ca61": FreelancerProfile(  # This is the address from user's logs
            skills=[
                "Web Development",
                "React",
                "TypeScript",
                "Tailwind CSS",
                "Solidity (Intermediate)",
            ],
            experience="5 years in full-stack development, specializing in dApp frontends and smart contract integration. Contributed to 3 major Web3 projects.",
        ),
        # Add more specific mock profiles as needed
    }

    profile = MOCK_PROFILES.get(
        address,
        FreelancerProfile(
            skills=["General Programming", "JavaScript", "Problem Solving"],
            experience="Experienced developer with a passion for learning new technologies.",
        ),
    )
    return profile


@app.get("/analyze-job-work-input/{job_id}")
async def analyze_job_work_input(job_id: int):
    """
    Analyzes the job description using Gemini AI to determine the appropriate work submission input type (IPFS hash or repository link).
    """
    if USE_MOCK_ANALYZE_INPUT:
        # Return a mock response for testing purposes
        print(f"Using mock AI analysis for job_id {job_id}.")
        return {
            "inputType": "repo_link",
            "reason": "Mock AI analysis: This job appears to be a code development task.",
        }

    try:
        # 1. Fetch job details from the blockchain
        job_details_from_chain = blockchain_service.get_job_details(job_id)
        if not job_details_from_chain or not job_details_from_chain.get(
            "descriptionIPFSHash"
        ):
            raise HTTPException(
                status_code=404, detail="Job description not found on the blockchain."
            )

        # 2. Fetch the job description from IPFS
        job_description_text = ipfs_service.get_file_content_from_ipfs(
            job_details_from_chain["descriptionIPFSHash"]
        )
        if not job_description_text:
            raise HTTPException(
                status_code=404, detail="Failed to fetch job description from IPFS."
            )

        # 3. Construct the prompt for Gemini
        prompt = f"""
            You are an expert project manager whose task is to determine the appropriate submission format for a freelance job. You need to decide if the nature of the job requires a submission via an IPFS hash (for creative assets, static files, designs, etc.) or a repository link (for code, software projects, dynamic websites, etc.).

            Job Description:
            ---
            {job_description_text}
            ---

            Your Output:
            You must provide a JSON response with two keys:
            - "inputType": "ipfs_hash" or "repo_link"
            - "reason": A concise, one-sentence explanation in English for your decision.

            Example 1 (Creative/Static):
            Job Description: "Design a logo for a new crypto project."
            Output: {{"inputType": "ipfs_hash", "reason": "Logo design is a creative asset best submitted as an IPFS hash for immutability and easy sharing."}}

            Example 2 (Code/Dynamic):
            Job Description: "Develop a smart contract for an ERC-721 token."
            Output: {{"inputType": "repo_link", "reason": "Smart contract development requires code review and version control, making a repository link the most suitable submission format."}}

            Analyze the provided job description and return ONLY the JSON object.
        """

        # 4. Call the Gemini model
        ai_response = await call_gemini_model(prompt, parse_json=True)

        if ai_response and "inputType" in ai_response and "reason" in ai_response:
            # Validate inputType to ensure it's one of the expected values
            if ai_response["inputType"] not in ["ipfs_hash", "repo_link"]:
                raise HTTPException(
                    status_code=500, detail="AI returned an invalid inputType."
                )
            return ai_response
        else:
            raise HTTPException(
                status_code=500, detail="Failed to get a valid analysis from AI."
            )

    except Exception as e:
        print(f"Error during AI work input analysis: {e}")
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=500, detail=f"An internal error occurred: {str(e)}"
        )


# =================================================================
# Gemini Model Configuration and Helper
# =================================================================

genai.configure(api_key=config.GOOGLE_API_KEY)

generation_config = {
    "temperature": 0.7,
    "top_p": 1,
    "top_k": 1,
    "max_output_tokens": 2048,
}

safety_settings = [
    {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {
        "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
        "threshold": "BLOCK_MEDIUM_AND_ABOVE",
    },
    {
        "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
        "threshold": "BLOCK_MEDIUM_AND_ABOVE",
    },
]

model = genai.GenerativeModel(
    model_name="gemini-flash-latest",  # Changed to gemini-flash-latest
    generation_config=generation_config,
    safety_settings=safety_settings,
)


async def call_gemini_model(prompt: str, parse_json: bool = True):
    """
    Calls the Gemini model with the given prompt and returns the parsed JSON response.
    """
    try:
        response = await model.generate_content_async(prompt)
        response_text = response.text

        # Extract JSON from markdown if present
        if response_text.startswith("```json") and response_text.endswith("```"):
            response_text = response_text[7:-3].strip()

        if parse_json:
            return json.loads(response_text)
        return response_text
    except Exception as e:
        print(f"Error calling Gemini model: {e}")
        return None


# =================================================================
# Constants for Trader Joe Swap (Avalanche C-Chain)
# =================================================================

USDC_ADDRESS = "0x04A0DC7C7029C647E4279ACcc64D2906D3dB283C"
WAVAX_ADDRESS = "0xD9D01A9F7C810EC035C0e42cB9E80Ef44D7f8692"  # Wrapped AVAX for swaps
TRADER_JOE_ROUTER_ADDRESS = (
    "0x18556DA13313f3532c54711497A8FedAC273220E"  # Router V2.2 (Liquidity Book)
)

# Minimal ERC20 ABI for approve, transferFrom, balanceOf, and decimals
ERC20_ABI = [
    {
        "constant": True,
        "inputs": [{"name": "_owner", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "balance", "type": "uint256"}],
        "type": "function",
    },
    {
        "constant": False,
        "inputs": [
            {"name": "_spender", "type": "address"},
            {"name": "_value", "type": "uint256"},
        ],
        "name": "approve",
        "outputs": [{"name": "success", "type": "bool"}],
        "type": "function",
    },
    {
        "constant": False,
        "inputs": [
            {"name": "_from", "type": "address"},
            {"name": "_to", "type": "address"},
            {"name": "_value", "type": "uint256"},
        ],
        "name": "transferFrom",
        "outputs": [{"name": "success", "type": "bool"}],
        "type": "function",
    },
    {
        "constant": True,
        "inputs": [],
        "name": "decimals",
        "outputs": [{"name": "", "type": "uint8"}],
        "type": "function",
    },
]

# ABI for Trader Joe Router 2.2 (provided by user) - Full ABI
TRADER_JOE_ROUTER_ABI = [
    {
        "inputs": [
            {
                "internalType": "contract ILBFactory",
                "name": "factory2_2",
                "type": "address",
            },
            {
                "internalType": "contract IJoeFactory",
                "name": "factoryV1",
                "type": "address",
            },
            {
                "internalType": "contract ILBLegacyFactory",
                "name": "legacyFactory",
                "type": "address",
            },
            {
                "internalType": "contract ILBLegacyRouter",
                "name": "legacyRouter",
                "type": "address",
            },
            {
                "internalType": "contract ILBFactory",
                "name": "factory2_1",
                "name": "factory2_1",
                "type": "address",
            },
            {"internalType": "contract IWNATIVE", "name": "wnative", "type": "address"},
        ],
        "stateMutability": "nonpayable",
        "type": "constructor",
    },
    {"inputs": [], "name": "JoeLibrary__InsufficientAmount", "type": "error"},
    {"inputs": [], "name": "JoeLibrary__InsufficientLiquidity", "type": "error"},
    {
        "inputs": [
            {"internalType": "uint256", "name": "amountSlippage", "type": "uint256"}
        ],
        "name": "LBRouter__AmountSlippageBPTooBig",
        "type": "error",
    },
    {
        "inputs": [
            {"internalType": "uint256", "name": "amountXMin", "type": "uint256"},
            {"internalType": "uint256", "name": "amountX", "type": "uint256"},
            {"internalType": "uint256", "name": "amountYMin", "type": "uint256"},
            {"internalType": "uint256", "name": "amountY", "type": "uint256"},
        ],
        "name": "LBRouter__AmountSlippageCaught",
        "type": "error",
    },
    {
        "inputs": [{"internalType": "uint256", "name": "id", "type": "uint256"}],
        "name": "LBRouter__BinReserveOverflows",
        "type": "error",
    },
    {"inputs": [], "name": "LBRouter__BrokenSwapSafetyCheck", "type": "error"},
    {
        "inputs": [
            {"internalType": "uint256", "name": "deadline", "type": "uint256"},
            {"internalType": "uint256", "name": "currentTimestamp", "type": "uint256"},
        ],
        "name": "LBRouter__DeadlineExceeded",
        "type": "error",
    },
    {
        "inputs": [
            {"internalType": "address", "name": "recipient", "type": "address"},
            {"internalType": "uint256", "name": "amount", "type": "uint256"},
        ],
        "name": "LBRouter__FailedToSendNATIVE",
        "type": "error",
    },
    {
        "inputs": [
            {"internalType": "uint256", "name": "idDesired", "type": "uint256"},
            {"internalType": "uint256", "name": "idSlippage", "type": "uint256"},
        ],
        "name": "LBRouter__IdDesiredOverflows",
        "type": "error",
    },
    {
        "inputs": [{"internalType": "int256", "name": "id", "type": "int256"}],
        "name": "LBRouter__IdOverflows",
        "type": "error",
    },
    {
        "inputs": [
            {"internalType": "uint256", "name": "activeIdDesired", "type": "uint256"},
            {"internalType": "uint256", "name": "idSlippage", "type": "uint256"},
            {"internalType": "uint256", "name": "activeId", "type": "uint256"},
        ],
        "name": "LBRouter__IdSlippageCaught",
        "type": "error",
    },
    {
        "inputs": [
            {"internalType": "uint256", "name": "amountOutMin", "type": "uint256"},
            {"internalType": "uint256", "name": "amountOut", "type": "uint256"},
        ],
        "name": "LBRouter__InsufficientAmountOut",
        "type": "error",
    },
    {
        "inputs": [
            {"internalType": "address", "name": "wrongToken", "type": "address"}
        ],
        "name": "LBRouter__InvalidTokenPath",
        "type": "error",
    },
    {
        "inputs": [{"internalType": "uint256", "name": "version", "type": "uint256"}],
        "name": "LBRouter__InvalidVersion",
        "type": "error",
    },
    {"inputs": [], "name": "LBRouter__LengthsMismatch", "type": "error"},
    {
        "inputs": [
            {"internalType": "uint256", "name": "amountInMax", "type": "uint256"},
            {"internalType": "uint256", "name": "amountIn", "type": "uint256"},
        ],
        "name": "LBRouter__MaxAmountInExceeded",
        "type": "error",
    },
    {"inputs": [], "name": "LBRouter__NotFactoryOwner", "type": "error"},
    {
        "inputs": [
            {"internalType": "address", "name": "tokenX", "type": "address"},
            {"internalType": "address", "name": "tokenY", "type": "address"},
            {"internalType": "uint256", "name": "binStep", "type": "uint256"},
        ],
        "name": "LBRouter__PairNotCreated",
        "type": "error",
    },
    {"inputs": [], "name": "LBRouter__SenderIsNotWNATIVE", "type": "error"},
    {
        "inputs": [{"internalType": "uint256", "name": "id", "type": "uint256"}],
        "name": "LBRouter__SwapOverflows",
        "type": "error",
    },
    {
        "inputs": [{"internalType": "uint256", "name": "excess", "type": "uint256"}],
        "name": "LBRouter__TooMuchTokensIn",
        "type": "error",
    },
    {
        "inputs": [
            {"internalType": "uint256", "name": "amount", "type": "uint256"},
            {"internalType": "uint256", "name": "reserve", "type": "uint256"},
        ],
        "name": "LBRouter__WrongAmounts",
        "type": "error",
    },
    {
        "inputs": [
            {"internalType": "address", "name": "tokenX", "type": "address"},
            {"internalType": "address", "name": "tokenY", "type": "address"},
            {"internalType": "uint256", "name": "amountX", "type": "uint256"},
            {"internalType": "uint256", "name": "amountY", "type": "uint256"},
            {"internalType": "uint256", "name": "msgValue", "type": "uint256"},
        ],
        "name": "LBRouter__WrongNativeLiquidityParameters",
        "type": "error",
    },
    {"inputs": [], "name": "LBRouter__WrongTokenOrder", "type": "error"},
    {"inputs": [], "name": "PackedUint128Math__SubUnderflow", "type": "error"},
    {"inputs": [], "name": "TokenHelper__TransferFailed", "type": "error"},
    {
        "inputs": [
            {
                "components": [
                    {
                        "internalType": "contract IERC20",
                        "name": "tokenX",
                        "type": "address",
                    },
                    {
                        "internalType": "contract IERC20",
                        "name": "tokenY",
                        "type": "address",
                    },
                    {"internalType": "uint256", "name": "binStep", "type": "uint256"},
                    {"internalType": "uint256", "name": "amountX", "type": "uint256"},
                    {"internalType": "uint256", "name": "amountY", "type": "uint256"},
                    {
                        "internalType": "uint256",
                        "name": "amountXMin",
                        "type": "uint256",
                    },
                    {
                        "internalType": "uint256",
                        "name": "amountYMin",
                        "type": "uint256",
                    },
                    {
                        "internalType": "uint256",
                        "name": "activeIdDesired",
                        "type": "uint256",
                    },
                    {
                        "internalType": "uint256",
                        "name": "idSlippage",
                        "type": "uint256",
                    },
                    {
                        "internalType": "int256[]",
                        "name": "deltaIds",
                        "type": "int256[]",
                    },
                    {
                        "internalType": "uint256[]",
                        "name": "distributionX",
                        "type": "uint256[]",
                    },
                    {
                        "internalType": "uint256[]",
                        "name": "distributionY",
                        "type": "uint256[]",
                    },
                    {"internalType": "address", "name": "to", "type": "address"},
                    {"internalType": "address", "name": "refundTo", "type": "address"},
                    {"internalType": "uint256", "name": "deadline", "type": "uint256"},
                ],
                "internalType": "struct ILBRouter.LiquidityParameters",
                "name": "liquidityParameters",
                "type": "tuple",
            }
        ],
        "name": "addLiquidity",
        "outputs": [
            {"internalType": "uint256", "name": "amountXAdded", "type": "uint256"},
            {"internalType": "uint256", "name": "amountYAdded", "type": "uint256"},
            {"internalType": "uint256", "name": "amountXLeft", "type": "uint256"},
            {"internalType": "uint256", "name": "amountYLeft", "type": "uint256"},
            {"internalType": "uint256[]", "name": "depositIds", "type": "uint256[]"},
            {
                "internalType": "uint256[]",
                "name": "liquidityMinted",
                "type": "uint256[]",
            },
        ],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [
            {
                "components": [
                    {
                        "internalType": "contract IERC20",
                        "name": "tokenX",
                        "type": "address",
                    },
                    {
                        "internalType": "contract IERC20",
                        "name": "tokenY",
                        "type": "address",
                    },
                    {"internalType": "uint256", "name": "binStep", "type": "uint256"},
                    {"internalType": "uint256", "name": "amountX", "type": "uint256"},
                    {"internalType": "uint256", "name": "amountY", "type": "uint256"},
                    {
                        "internalType": "uint256",
                        "name": "amountXMin",
                        "type": "uint256",
                    },
                    {
                        "internalType": "uint256",
                        "name": "amountYMin",
                        "type": "uint256",
                    },
                    {
                        "internalType": "uint256",
                        "name": "activeIdDesired",
                        "type": "uint256",
                    },
                    {
                        "internalType": "uint256",
                        "name": "idSlippage",
                        "type": "uint256",
                    },
                    {
                        "internalType": "int256[]",
                        "name": "deltaIds",
                        "type": "int256[]",
                    },
                    {
                        "internalType": "uint256[]",
                        "name": "distributionX",
                        "type": "uint256[]",
                    },
                    {
                        "internalType": "uint256[]",
                        "name": "distributionY",
                        "type": "uint256[]",
                    },
                    {"internalType": "address", "name": "to", "type": "address"},
                    {"internalType": "address", "name": "refundTo", "type": "address"},
                    {"internalType": "uint256", "name": "deadline", "type": "uint256"},
                ],
                "internalType": "struct ILBRouter.LiquidityParameters",
                "name": "liquidityParameters",
                "type": "tuple",
            }
        ],
        "name": "addLiquidityNATIVE",
        "outputs": [
            {"internalType": "uint256", "name": "amountXAdded", "type": "uint256"},
            {"internalType": "uint256", "name": "amountYAdded", "type": "uint256"},
            {"internalType": "uint256", "name": "amountXLeft", "type": "uint256"},
            {"internalType": "uint256", "name": "amountYLeft", "type": "uint256"},
            {"internalType": "uint256[]", "name": "depositIds", "type": "uint256[]"},
            {
                "internalType": "uint256[]",
                "name": "liquidityMinted",
                "type": "uint256[]",
            },
        ],
        "stateMutability": "payable",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "contract IERC20", "name": "tokenX", "type": "address"},
            {"internalType": "contract IERC20", "name": "tokenY", "type": "address"},
            {"internalType": "uint24", "name": "activeId", "type": "uint24"},
            {"internalType": "uint16", "name": "binStep", "type": "uint16"},
        ],
        "name": "createLBPair",
        "outputs": [
            {"internalType": "contract ILBPair", "name": "pair", "type": "address"}
        ],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "getFactory",
        "outputs": [
            {
                "internalType": "contract ILBFactory",
                "name": "lbFactory",
                "type": "address",
            }
        ],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "getFactoryV2_1",
        "outputs": [
            {
                "internalType": "contract ILBFactory",
                "name": "lbFactory",
                "type": "address",
            }
        ],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "contract ILBPair", "name": "pair", "type": "address"},
            {"internalType": "uint256", "name": "price", "type": "uint256"},
        ],
        "name": "getIdFromPrice",
        "outputs": [{"internalType": "uint24", "name": "", "type": "uint24"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "getLegacyFactory",
        "outputs": [
            {
                "internalType": "contract ILBLegacyFactory",
                "name": "legacyLBfactory",
                "type": "address",
            }
        ],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "getLegacyRouter",
        "outputs": [
            {
                "internalType": "contract ILBLegacyRouter",
                "name": "legacyRouter",
                "type": "address",
            }
        ],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "contract ILBPair", "name": "pair", "type": "address"},
            {"internalType": "uint24", "name": "id", "type": "uint24"},
        ],
        "name": "getPriceFromId",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "contract ILBPair", "name": "pair", "type": "address"},
            {"internalType": "uint128", "name": "amountOut", "type": "uint128"},
            {"internalType": "bool", "name": "swapForY", "type": "bool"},
        ],
        "name": "getSwapIn",
        "outputs": [
            {"internalType": "uint128", "name": "amountIn", "type": "uint128"},
            {"internalType": "uint128", "name": "amountOutLeft", "type": "uint128"},
            {"internalType": "uint128", "name": "fee", "type": "uint128"},
        ],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "contract ILBPair", "name": "pair", "type": "address"},
            {"internalType": "uint128", "name": "amountIn", "type": "uint128"},
            {"internalType": "bool", "name": "swapForY", "type": "bool"},
        ],
        "name": "getSwapOut",
        "outputs": [
            {"internalType": "uint128", "name": "amountInLeft", "type": "uint128"},
            {"internalType": "uint128", "name": "amountOut", "type": "uint128"},
            {"internalType": "uint128", "name": "fee", "type": "uint128"},
        ],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "getV1Factory",
        "outputs": [
            {
                "internalType": "contract IJoeFactory",
                "name": "factoryV1",
                "type": "address",
            }
        ],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "getWNATIVE",
        "outputs": [
            {"internalType": "contract IWNATIVE", "name": "wnative", "type": "address"}
        ],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "contract IERC20", "name": "tokenX", "type": "address"},
            {"internalType": "contract IERC20", "name": "tokenY", "type": "address"},
            {"internalType": "uint16", "name": "binStep", "type": "uint16"},
            {"internalType": "uint256", "name": "amountXMin", "type": "uint256"},
            {"internalType": "uint256", "name": "amountYMin", "type": "uint256"},
            {"internalType": "uint256[]", "name": "ids", "type": "uint256[]"},
            {"internalType": "uint256[]", "name": "amounts", "type": "uint256[]"},
            {"internalType": "address", "name": "to", "type": "address"},
            {"internalType": "uint256", "name": "deadline", "type": "uint256"},
        ],
        "name": "removeLiquidity",
        "outputs": [
            {"internalType": "uint256", "name": "amountX", "type": "uint256"},
            {"internalType": "uint256", "name": "amountY", "type": "uint256"},
        ],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "contract IERC20", "name": "token", "type": "address"},
            {"internalType": "uint16", "name": "binStep", "type": "uint16"},
            {"internalType": "uint256", "name": "amountTokenMin", "type": "uint256"},
            {"internalType": "uint256", "name": "amountNATIVEMin", "type": "uint256"},
            {"internalType": "uint256[]", "name": "ids", "type": "uint256[]"},
            {"internalType": "uint256[]", "name": "amounts", "type": "uint256[]"},
            {"internalType": "address payable", "name": "to", "type": "address"},
            {"internalType": "uint256", "name": "deadline", "type": "uint256"},
        ],
        "name": "removeLiquidityNATIVE",
        "outputs": [
            {"internalType": "uint256", "name": "amountToken", "type": "uint256"},
            {"internalType": "uint256", "name": "amountNATIVE", "type": "uint256"},
        ],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "uint256", "name": "amountOutMin", "type": "uint256"},
            {
                "components": [
                    {
                        "internalType": "uint256[]",
                        "name": "pairBinSteps",
                        "type": "uint256[]",
                    },
                    {
                        "internalType": "enum ILBRouter.Version[]",
                        "name": "versions",
                        "type": "uint8[]",
                    },
                    {
                        "internalType": "contract IERC20[]",
                        "name": "tokenPath",
                        "type": "address[]",
                    },
                ],
                "internalType": "struct ILBRouter.Path",
                "name": "path",
                "type": "tuple",
            },
            {"internalType": "address", "name": "to", "type": "address"},
            {"internalType": "uint256", "name": "deadline", "type": "uint256"},
        ],
        "name": "swapExactNATIVEForTokens",
        "outputs": [
            {"internalType": "uint256", "name": "amountOut", "type": "uint256"}
        ],
        "stateMutability": "payable",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "uint256", "name": "amountOutMin", "type": "uint256"},
            {
                "components": [
                    {
                        "internalType": "uint256[]",
                        "name": "pairBinSteps",
                        "type": "uint256[]",
                    },
                    {
                        "internalType": "enum ILBRouter.Version[]",
                        "name": "versions",
                        "type": "uint8[]",
                    },
                    {
                        "internalType": "contract IERC20[]",
                        "name": "tokenPath",
                        "type": "address[]",
                    },
                ],
                "internalType": "struct ILBRouter.Path",
                "name": "path",
                "type": "tuple",
            },
            {"internalType": "address", "name": "to", "type": "address"},
            {"internalType": "uint256", "name": "deadline", "type": "uint256"},
        ],
        "name": "swapExactNATIVEForTokensSupportingFeeOnTransferTokens",
        "outputs": [
            {"internalType": "uint256", "name": "amountOut", "type": "uint256"}
        ],
        "stateMutability": "payable",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "uint256", "name": "amountIn", "type": "uint256"},
            {
                "internalType": "uint256",
                "name": "amountOutMinNATIVE",
                "type": "uint256",
            },
            {
                "components": [
                    {
                        "internalType": "uint256[]",
                        "name": "pairBinSteps",
                        "type": "uint256[]",
                    },
                    {
                        "internalType": "enum ILBRouter.Version[]",
                        "name": "versions",
                        "type": "uint8[]",
                    },
                    {
                        "internalType": "contract IERC20[]",
                        "name": "tokenPath",
                        "type": "address[]",
                    },
                ],
                "internalType": "struct ILBRouter.Path",
                "name": "path",
                "type": "tuple",
            },
            {"internalType": "address payable", "name": "to", "type": "address"},
            {"internalType": "uint256", "name": "deadline", "type": "uint256"},
        ],
        "name": "swapExactTokensForNATIVE",
        "outputs": [
            {"internalType": "uint256", "name": "amountOut", "type": "uint256"}
        ],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "uint256", "name": "amountIn", "type": "uint256"},
            {
                "internalType": "uint256",
                "name": "amountOutMinNATIVE",
                "type": "uint256",
            },
            {
                "components": [
                    {
                        "internalType": "uint256[]",
                        "name": "pairBinSteps",
                        "type": "uint256[]",
                    },
                    {
                        "internalType": "enum ILBRouter.Version[]",
                        "name": "versions",
                        "type": "uint8[]",
                    },
                    {
                        "internalType": "contract IERC20[]",
                        "name": "tokenPath",
                        "type": "address[]",
                    },
                ],
                "internalType": "struct ILBRouter.Path",
                "name": "path",
                "type": "tuple",
            },
            {"internalType": "address payable", "name": "to", "type": "address"},
            {"internalType": "uint256", "name": "deadline", "type": "uint256"},
        ],
        "name": "swapExactTokensForNATIVESupportingFeeOnTransferTokens",
        "outputs": [
            {"internalType": "uint256", "name": "amountOut", "type": "uint256"}
        ],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "uint256", "name": "amountIn", "type": "uint256"},
            {"internalType": "uint256", "name": "amountOutMin", "type": "uint256"},
            {
                "components": [
                    {
                        "internalType": "uint256[]",
                        "name": "pairBinSteps",
                        "type": "uint256[]",
                    },
                    {
                        "internalType": "enum ILBRouter.Version[]",
                        "name": "versions",
                        "type": "uint8[]",
                    },
                    {
                        "internalType": "contract IERC20[]",
                        "name": "tokenPath",
                        "type": "address[]",
                    },
                ],
                "internalType": "struct ILBRouter.Path",
                "name": "path",
                "type": "tuple",
            },
            {"internalType": "address", "name": "to", "type": "address"},
            {"internalType": "uint256", "name": "deadline", "type": "uint256"},
        ],
        "name": "swapExactTokensForTokens",
        "outputs": [
            {"internalType": "uint256", "name": "amountOut", "type": "uint256"}
        ],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "uint256", "name": "amountIn", "type": "uint256"},
            {"internalType": "uint256", "name": "amountOutMin", "type": "uint256"},
            {
                "components": [
                    {
                        "internalType": "uint256[]",
                        "name": "pairBinSteps",
                        "type": "uint256[]",
                    },
                    {
                        "internalType": "enum ILBRouter.Version[]",
                        "name": "versions",
                        "type": "uint8[]",
                    },
                    {
                        "internalType": "contract IERC20[]",
                        "name": "tokenPath",
                        "type": "address[]",
                    },
                ],
                "internalType": "struct ILBRouter.Path",
                "name": "path",
                "type": "tuple",
            },
            {"internalType": "address", "name": "to", "type": "address"},
            {"internalType": "uint256", "name": "deadline", "type": "uint256"},
        ],
        "name": "swapExactTokensForTokensSupportingFeeOnTransferTokens",
        "outputs": [
            {"internalType": "uint256", "name": "amountOut", "type": "uint256"}
        ],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "uint256", "name": "amountOut", "type": "uint256"},
            {
                "components": [
                    {
                        "internalType": "uint256[]",
                        "name": "pairBinSteps",
                        "type": "uint256[]",
                    },
                    {
                        "internalType": "enum ILBRouter.Version[]",
                        "name": "versions",
                        "type": "uint8[]",
                    },
                    {
                        "internalType": "contract IERC20[]",
                        "name": "tokenPath",
                        "type": "address[]",
                    },
                ],
                "internalType": "struct ILBRouter.Path",
                "name": "path",
                "type": "tuple",
            },
            {"internalType": "address", "name": "to", "type": "address"},
            {"internalType": "uint256", "name": "deadline", "type": "uint256"},
        ],
        "name": "swapNATIVEForExactTokens",
        "outputs": [
            {"internalType": "uint256[]", "name": "amountsIn", "type": "uint256[]"}
        ],
        "stateMutability": "payable",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "uint256", "name": "amountNATIVEOut", "type": "uint256"},
            {"internalType": "uint256", "name": "amountInMax", "type": "uint256"},
            {
                "components": [
                    {
                        "internalType": "uint256[]",
                        "name": "pairBinSteps",
                        "type": "uint256[]",
                    },
                    {
                        "internalType": "enum ILBRouter.Version[]",
                        "name": "versions",
                        "type": "uint8[]",
                    },
                    {
                        "internalType": "contract IERC20[]",
                        "name": "tokenPath",
                        "type": "address[]",
                    },
                ],
                "internalType": "struct ILBRouter.Path",
                "name": "path",
                "type": "tuple",
            },
            {"internalType": "address payable", "name": "to", "type": "address"},
            {"internalType": "uint256", "name": "deadline", "type": "uint256"},
        ],
        "name": "swapTokensForExactNATIVE",
        "outputs": [
            {"internalType": "uint256[]", "name": "amountsIn", "type": "uint256[]"}
        ],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "uint256", "name": "amountOut", "type": "uint256"},
            {"internalType": "uint256", "name": "amountInMax", "type": "uint256"},
            {
                "components": [
                    {
                        "internalType": "uint256[]",
                        "name": "pairBinSteps",
                        "type": "uint256[]",
                    },
                    {
                        "internalType": "enum ILBRouter.Version[]",
                        "name": "versions",
                        "type": "uint8[]",
                    },
                    {
                        "internalType": "contract IERC20[]",
                        "name": "tokenPath",
                        "type": "address[]",
                    },
                ],
                "internalType": "struct ILBRouter.Path",
                "name": "path",
                "type": "tuple",
            },
            {"internalType": "address", "name": "to", "type": "address"},
            {"internalType": "uint256", "name": "deadline", "type": "uint256"},
        ],
        "name": "swapTokensForExactTokens",
        "outputs": [
            {"internalType": "uint256[]", "name": "amountsIn", "type": "uint256[]"}
        ],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "contract IERC20", "name": "token", "type": "address"},
            {"internalType": "address", "name": "to", "type": "address"},
            {"internalType": "uint256", "name": "amount", "type": "uint256"},
        ],
        "name": "sweep",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "contract ILBToken", "name": "lbToken", "type": "address"},
            {"internalType": "address", "name": "to", "type": "address"},
            {"internalType": "uint256[]", "name": "ids", "type": "uint256[]"},
            {"internalType": "uint256[]", "name": "amounts", "type": "uint256[]"},
        ],
        "name": "sweepLBToken",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {"stateMutability": "payable", "type": "receive"},
]
