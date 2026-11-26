import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("importa, atualiza, filtra, exporta, concilia e limpa sem enviar dados", async ({
  page,
  context,
  browser,
}) => {
  const network: string[] = [];
  page.on("request", (request) => {
    if (
      ["xhr", "fetch"].includes(request.resourceType()) ||
      request.method() !== "GET"
    ) {
      network.push(request.method() + " " + request.url());
    }
  });
  expect(await context.cookies()).toHaveLength(0);
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { name: "Visão geral" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Importar dados" }).click();
  await expect(page.locator('input[type="file"],textarea')).toHaveCount(0);
  async function accept(scenario: string) {
    await page.getByLabel("Cenário de importação").selectOption(scenario);
    await page.getByRole("button", { name: "Analisar dados" }).click();
    await page.getByRole("button", { name: "Confirmar importação" }).click();
    await expect(page.getByText("1 chamado(s) salvo(s).")).toBeVisible();
  }
  await accept("list");
  await accept("details");
  await accept("history");
  await page.getByRole("link", { name: "Chamados" }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: "90001" })).toBeVisible();
  await expect(page.getByRole("button", { name: "90002" })).toBeVisible();
  await page.getByRole("textbox", { name: "Pesquisar" }).fill("100001");
  await expect(page.getByRole("button", { name: "90002" })).toHaveCount(0);
  await page.getByRole("button", { name: "90001" }).click();
  await expect(page.getByText(/R\$ 20,10/)).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Exportar CSV" }).click(),
  ]);
  const contents = await readFile((await download.path())!, "utf8");
  expect(contents).toContain("90001");
  expect(contents).not.toContain("90002");
  await page.getByRole("link", { name: "Inventários" }).click();
  await page.getByRole("button", { name: "Cruzar chamados pendentes" }).click();
  await expect(page.getByText(/90002 · SOBRA/)).toBeVisible();

  const isolated = await browser.newPage();
  await isolated.goto(new URL("/chamados", page.url()).href);
  await expect(isolated.getByText("Nenhum chamado encontrado.")).toBeVisible();
  await isolated.close();
  await page.getByRole("button", { name: "Limpar demonstração" }).click();
  await page.getByRole("link", { name: "Chamados" }).click();
  await expect(page.getByText("Nenhum chamado encontrado.")).toBeVisible();
  expect(network).toEqual([]);
});

test("mantém navegação acessível e cabe na largura da tela", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Visão geral" }),
  ).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Ir para o conteúdo" }),
  ).toBeFocused();
  await expect(page.getByRole("heading", { name: "Financeiro" })).toBeVisible();
  const analysis = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(analysis.violations).toEqual([]);
  await page.getByRole("link", { name: "Importar dados" }).click();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(page.viewportSize()!.width);
});
