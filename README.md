# 🚀 Versel Staking Hash App

A decentralized application (dApp) for staking HASH tokens and earning rewards, built with cutting-edge web3 technologies. This project showcases a seamless user experience for interacting with a staking smart contract.

## ✨ Features

*   **Token Staking**: Stake your HASH tokens across multiple tiers (3M, 6M, 12M) to earn attractive rewards.
*   **Combined Staking Action**: A streamlined "Staking" button intelligently handles both token approval and staking in a single user interaction.
*   **Real-time Rewards**: View your available and claimable rewards in real-time.
*   **User-Friendly Interface**: Built with Next.js and Thirdweb for a modern and intuitive experience.

## 🛠️ Technologies Used

*   **Next.js**: React framework for production.
*   **TypeScript**: Strongly typed JavaScript for enhanced code quality.
*   **Thirdweb**: Powerful SDK for building web3 applications.
*   **Ethers.js / Viem / Wagmi**: (Implicitly used by Thirdweb for blockchain interaction)
*   **Solidity**: Smart contract development language.

## 🚀 Getting Started

Follow these steps to set up and run the project locally:

1.  **Clone the repository**:
    ```bash
    git clone <repository-url>
    cd "Versel staking hash"
    ```
2.  **Install dependencies**:
    ```bash
    npm install
    # or
    yarn install
    ```
3.  **Configure Environment Variables**:
    Create a `.env` file in the root directory and add your Thirdweb Client ID:
    ```
    NEXT_PUBLIC_CLIENT_ID="your_thirdweb_client_id"
    ```
    (Replace `your_thirdweb_client_id` with your actual Thirdweb Client ID.)
4.  **Run the development server**:
    ```bash
    npm run dev
    # or
    yarn dev
    ```
5.  **Open in browser**:
    Open [http://localhost:3000](http://localhost:3000) to view the application.

## 📜 Contract Details

The staking contract offers the following tiers (test version with minutes):
*   **3M Tier**: 3% APR
*   **6M Tier**: 5% APR
*   **12M Tier**: 9% APR

---
*This README was generated with the help of Gemini CLI.*