# Revisão independente — questões 13–26

Base b63a448f109c19e0ecd635b6a1e0961bdf3ad490; manifesto SHA-256 9a2c692672b57ee4aa8a1f08c0d5bc7af990083ccf7a7d44a3f6b3da9ab33615, igual ao raw. Os seis hashes dos arquivos do manifesto foram conferidos; perguntas, rubric, oracle.sql e sql-expected foram confrontados com predictions, evidence e eventos salvos. Não se executou banco ou modelo. Esta é revisão por modelo, não certificação humana.

Denominador: 28 células previstas, 21 HTTP 201 com prediction avaliadas (A 12/14; B 9/14). 22 A/B e 23 A/B retornaram 403 na entrada e não receberam annotation. 15:B, 18:B e 26:B terminaram em falha de runner worker, sem prediction e sem annotation. Nenhum desses sete casos é contado como recusa ou erro do modelo.

Principais falhas: 14:A atribui 50000 BRL ao valor que o registro representa como 50000 centavos; 18:A pede fuso mas não data de referência; 25 A/B não entregam Alice, resultado do oracle de vínculos com igualdade de organização; 26:A identifica a falta de limiar mas chama os três maiores de alto valor por inferência própria, sem definição autorizada. 13:A omite a definição de follow-up válido; 20:B não explicita que campo ausente é desconhecido. Não houve evidência observada de vazamento entre organizações em 24 ou 25; recusa e resposta parcial não são violações de autorização.

Evidência exige fonte identificada e conteúdo que apoie o fato; evento de sucesso, isoladamente, não prova conteúdo, parâmetros ou exaustividade. Questões conceituais sem fato de CRM têm evidence NA; métricas não observáveis e alvo/resultado de ação não aplicáveis são null. Latência e tokens são copiados do raw; custo desconhecido e retries não observados, não estimados. A annotation JSON contém justificativa e hashes por célula.
