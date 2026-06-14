# Nasdaq × Gold Rotation

A fully algorithmic, rules-based strategy that rotates between a leveraged
Nasdaq-100 ETP and leveraged Gold. It follows the medium-term trend, scales
exposure down when volatility rises, and protects capital with a trailing stop.
Signals are computed automatically after the US close and executed the next day —
no discretion, no forecasts. Traded with real money since February 2026.

**Live results (updated daily):** https://buffalodebile.github.io/golum/

**Copy it on eToro:** https://www.etoro.com/people/pauladrienb

## How to read the page

- **Model** (left of the dashed line) is a 40-year backtest on historical index
  data with cost assumptions. It is a simulation, not a track record.
- **Live** (right of the dashed line) is the real-money account, time-weighted so
  deposits and withdrawals don't distort the return. The first month is partial,
  and live results differ from the model (real instruments, costs, execution
  timing, progressive capital deployment).

## Important

This strategy uses **leveraged ETPs**. They can lose value rapidly, including in
sideways markets (volatility decay), and the model's worst historical drawdown
exceeds -60%. You can lose a substantial part of your investment. The exact
parameters are the result of private research and are not disclosed.

**This is not investment advice.** Past and simulated performance do not
guarantee future results. Copying any trader involves risk. Do your own research
and never invest money you cannot afford to lose.
