import React, { useEffect } from "react"
import Head from "next/head"
import { Header } from "../components/header"
import MD from "../content/index.md"
import { Footer } from "../components/footer"
import icon from '../public/icon.svg'

export default function Index() {
    return (
        <div className="d-flex flex-column fullscreen">
            <Head>
                <title>co-consistent</title>
                <meta
                    name="description"
                    content="globally consistent event ordering for decentralized distributed systems"></meta>
                <meta name="viewport" content="initial-scale=1.0, width=device-width" />
                <link rel="icon" type="image/svg+xml" href={icon} />
                <link rel="mask-icon" href={icon} color="#fff" />
            </Head>
            <Header selectedIndex={-1} />
            <div className="container-lg p-3">
                <MD />
            </div>
            <Footer />
        </div>
    )
}
