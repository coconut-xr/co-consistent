# co-consistent

[![Build Status](https://img.shields.io/github/workflow/status/cocoss-org/co-consistent/Depolyment)](https://github.com/cocoss-org/co-consistent/actions)&nbsp;
[![Npm package version](https://badgen.net/npm/v/co-consistent)](https://npmjs.com/package/co-consistent)&nbsp;
[![GitHub license](https://img.shields.io/github/license/cocoss-org/co-consistent.svg)](https://github.com/cocoss-org/co-consistent/blob/master/LICENSE)&nbsp;
[![Twitter](https://badgen.net/badge/icon/twitter?icon=twitter&label)](https://twitter.com/BelaBohlender)

globally consistent event ordering for decentralized distributed systems

[**Example**: A shared red ball that bounces of walls and its direction can be inverted by every client*](https://cocoss-org.github.io/co-consistent/continous/)

![Continous Example](continous-example.gif)

`npm i co-consistent`

## **Why?**

Synchronizing action ordering across multiple clients in a network can be done in various ways. **co-consistent** uses a shared timeline to order events and a clock that can jump forward in time.  
Other concepts relay on a heavy server to order actions and compute state.  
**co-consistent** offloads this work to the clients and is designed for a peer-to-peer scenario but can also be used in a client-server architecture.

## [**Examples**](https://cocoss-org.github.io/co-consistent)

_The code for each example can be found on the respective pages_

-   [State](https://cocoss-org.github.io/co-consistent/state) - simple example with multiplication and division
-   [Parallel](https://cocoss-org.github.io/co-consistent/parallel) - edit states in parallel without touching the other
-   [Continous](https://cocoss-org.github.io/co-consistent/continous) - extrapolate state for representing the continous position of a ball

## [**Simulated Networking Example**](https://cocoss-org.github.io/co-share/consistent)

_The **Continous** example implemented with co-share and simulated in the browser with latency and jitter._