"""Hand-solved cases for science/dp.py, the independent price-only DP (issue #107)."""
import math
import unittest

from science import dp


class ToyDayTests(unittest.TestCase):
    """4-step toy days with 1 kWh levels and 1-hour steps, solved on paper."""

    def solve(self, prices, **kw):
        args = dict(levels=2, level_kwh=1.0, eta=1.0, start_level=0, end_level=0, step_h=1.0,
                    charge_kw=1.0, discharge_kw=1.0)
        args.update(kw)
        return dp.solve(prices, **args)

    def test_two_cycles_lossless(self):
        # charge 1 kWh at $10, sell at $50, twice: 2 x (50 - 10) / 1000 = $0.08
        r = self.solve([10, 50, 10, 50])
        self.assertAlmostEqual(r["value_usd"], 0.08, places=12)
        self.assertEqual(r["levels"], [0, 1, 0, 1, 0])

    def test_losses_on_each_leg(self):
        # eta 0.5: 1 kWh stored costs 2 kWh at $10, returns 0.5 kWh at $50: 2 x (25 - 20) / 1000
        r = self.solve([10, 50, 10, 50], eta=0.5, charge_kw=2.0)
        self.assertAlmostEqual(r["value_usd"], 0.01, places=12)
        self.assertEqual(r["grid_kwh"], [-2.0, 0.5, -2.0, 0.5])

    def test_charge_limit_at_the_meter_blocks_a_move(self):
        # eta 0.5 needs 2 kWh from the grid per level; a 1 kW limit makes every charge infeasible
        r = self.solve([10, 50, 10, 50], eta=0.5, charge_kw=1.0)
        self.assertAlmostEqual(r["value_usd"], 0.0, places=12)
        self.assertEqual(r["levels"], [0, 0, 0, 0, 0])

    def test_terminal_level_is_enforced(self):
        # start and end at 1 kWh: sell at $50, buy back at $10 = $0.04; with no end floor, $0.05
        self.assertAlmostEqual(self.solve([50, 10, 10, 10], start_level=1, end_level=1)["value_usd"],
                               0.04, places=12)
        self.assertAlmostEqual(self.solve([50, 10, 10, 10], start_level=1, end_level=0)["value_usd"],
                               0.05, places=12)

    def test_negative_prices_pay_to_charge(self):
        # buy 2 kWh over two steps at -$20 (paid $0.04), sell both at $5 ($0.01)
        r = self.solve([-20, -20, 5, 5])
        self.assertAlmostEqual(r["value_usd"], 0.05, places=12)

    def test_unreachable_end_raises(self):
        with self.assertRaises(ValueError):
            self.solve([10, 10, 10, 10], start_level=0, end_level=2, charge_kw=0.0)


class SiteReachTests(unittest.TestCase):
    def test_site_reach_is_4_up_5_down(self):
        eta = math.sqrt(0.88)
        up, down = dp.reach(level_kwh=12.5, eta=eta, charge_kw=250, discharge_kw=250, step_h=0.25)
        self.assertEqual((up, down), (4, 5))

    def test_price_only_day_holds_each_hour_four_steps(self):
        # flat price: nothing to gain, value 0; one cheap hour and one dear hour: a positive value
        host = [300.0] * 96
        self.assertAlmostEqual(dp.price_only_day([30.0] * 24, host)["usd_per_mw_day"], 0.0, places=9)
        p = [30.0] * 24
        p[3], p[18] = 0.0, 100.0
        v = dp.price_only_day(p, host)["usd_per_mw_day"]
        # bounded by 250 kW x 1 h each way per MW (1 MWh per MW): at most 1 x 100 x eta, at least 0
        self.assertGreater(v, 0.0)
        self.assertLess(v, 100.0 * 1.0)

    def test_export_limit_caps_discharge_at_host_load(self):
        p = [0.0] * 24
        p[18] = 100.0
        full = dp.price_only_day(p, [300.0] * 96)["usd_per_mw_day"]
        capped = dp.price_only_day(p, [100.0] * 96)["usd_per_mw_day"]
        self.assertLess(capped, full)


class StoredCycleTests(unittest.TestCase):
    """Cycles count on stored energy (#213), not on energy delivered to the grid."""

    def test_stored_cycles_from_the_level_path(self):
        # 40 levels of 12.5 kWh: 0 -> 40 -> 0 drains the full 500 kWh once; half-way twice is one cycle
        self.assertAlmostEqual(dp.stored_cycles([0, 40, 0], 12.5, 500.0), 1.0, places=12)
        self.assertAlmostEqual(dp.stored_cycles([0, 20, 0, 20, 0], 12.5, 500.0), 1.0, places=12)
        self.assertAlmostEqual(dp.stored_cycles([0, 40], 12.5, 500.0), 0.0, places=12)

    def test_hand_checked_250_kwh_to_the_grid(self):
        # 250 kWh sold to the grid at sqrt(0.88): 250 / 0.938 / 500 = 0.5330 cycles (the #213 example)
        eta = math.sqrt(0.88)
        stored_out = 250.0 / eta
        self.assertAlmostEqual(stored_out / 500.0, 0.53300, places=4)

    def test_price_only_day_cycles_equal_grid_kwh_over_eta_over_capacity(self):
        host = [300.0] * 96
        p = [30.0] * 24
        p[3], p[18] = 0.0, 100.0
        r = dp.price_only_day(p, host)
        want = r["discharged_kwh"] / math.sqrt(0.88) / dp.PULSE_KWH
        self.assertAlmostEqual(r["pulse_cycles"], want, places=9)
        self.assertGreater(r["pulse_cycles"], 0.0)
        self.assertLess(r["pulse_cycles"], 1.0 + 1e-9)  # one 250 kW hour in and out at most per swing here


if __name__ == "__main__":
    unittest.main()
