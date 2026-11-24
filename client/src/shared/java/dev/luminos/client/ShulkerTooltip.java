package dev.luminos.client;

import net.fabricmc.fabric.api.client.item.v1.ItemTooltipCallback;
import net.minecraft.ChatFormatting;
import net.minecraft.client.Minecraft;
import net.minecraft.core.component.DataComponents;
import net.minecraft.network.chat.Component;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.world.item.component.BundleContents;
import net.minecraft.world.item.component.ItemContainerContents;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Hover a shulker box, bundle or ender chest to see everything inside, with counts merged per item. Text lines (a Shulker Box
 * Tooltip-style grid needs a tooltip-image mixin per version, which this client avoids). Ender chests only show what the server has
 * already sent this session, which is what you saw the last time you opened one.
 */
public final class ShulkerTooltip {
	private ShulkerTooltip() {}

	private static final int MAX_LINES = 14;

	public static void register() {
		ItemTooltipCallback.EVENT.register((stack, ctx, flag, lines) -> {
			if (!Config.flag("shulker_tooltip.on", true)) return;
			List<ItemStack> inside = contents(stack);
			if (inside == null || inside.isEmpty()) return;
			lines.removeIf(l -> { String s = l.getString(); return s.matches(".+ x\\d+") || s.matches("and \\d+ more\\.*.*") || s.matches("\\+\\d+ more.*"); });
			Map<String, Integer> merged = new LinkedHashMap<>();
			int total = 0;
			for (ItemStack s : inside) { merged.merge(s.getHoverName().getString(), s.getCount(), Integer::sum); total += s.getCount(); }
			lines.add(Component.literal("Contents: " + total + " items, " + merged.size() + " kinds").withStyle(ChatFormatting.GRAY));
			int n = 0;
			for (var e : merged.entrySet()) {
				if (n++ >= MAX_LINES) { lines.add(Component.literal("+ " + (merged.size() - MAX_LINES) + " more kinds").withStyle(ChatFormatting.DARK_GRAY)); break; }
				lines.add(Component.literal("  " + e.getKey() + " x" + e.getValue()).withStyle(ChatFormatting.GRAY));
			}
		});
	}

	private static List<ItemStack> contents(ItemStack stack) {
		List<ItemStack> out = new ArrayList<>();
		ItemContainerContents c = stack.get(DataComponents.CONTAINER);
		if (c != null) { out.addAll(Nav.containerItems(c)); return out; }
		BundleContents b = stack.get(DataComponents.BUNDLE_CONTENTS);
		if (b != null) { out.addAll(Nav.bundleItems(b)); return out; }
		if (stack.is(Items.ENDER_CHEST)) {
			var p = Minecraft.getInstance().player;
			if (p == null) return null;
			var inv = p.getEnderChestInventory();
			for (int i = 0; i < inv.getContainerSize(); i++) if (!inv.getItem(i).isEmpty()) out.add(inv.getItem(i));
			return out;
		}
		return null;
	}
}
