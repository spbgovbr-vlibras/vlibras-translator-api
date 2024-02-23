import app from 'vlibras-translator-api/src/app/app'
import request from 'supertest'
import { beforeEach, afterEach, describe, it } from '@jest/globals';

let texto = "nesciunt. Est officia obcaecati et assumenda quae vel labore internos et modi sunt quo voluptas quae sed sunt voluptatem? Id assumenda iusto a reiciendis galisum est beatae architecto ad iste nihil qui delectus necessitatibus est nobis voluptatum et sint nulla. Vel expedita veritatis est repellendus atque est quis minus et rerum quas est internos dolores ut provident totam! </p><p>Aut optio omnis id quidem ullam id libero quos sit numquam accusamus At voluptates quam. Qui facere earum aut eaque harum et tenetur molestias et consequatur doloremque aut aspernatur placeat. Eos recusandae quos et distinctio eveniet ut cupiditate quia a quis dolor et omnis dolores! Non aperiam dolor sed quia eius qui atque mollitia et atque commodi et vero laudantium ut minima autem. Nam ullam quasi At nihil nihil sit unde exercitationem At iste veniam ea ratione itaque et veritatis placeat est tempore modi. Aut iure repudiandae quo voluptates dolorum ea aperiam Quis et libero delectus aut rerum obcaecati et voluptas eligendi et consequuntur nemo? At perferendis esse ut cumque nesciunt ab aliquam illum. </p><p>Non commodi placeat ea quasi iste in saepe perspiciatis eum voluptas nobis in quisquam dolorem qui nisi consequatur est ratione voluptas. Aut obcaecati totam non adipisci dignissimos non sint enim 33 nostrum harum cum quia voluptas 33 labore iste. At voluptatem esse At quae labore id eaque nostrum. Ad ratione doloribus a iure Quis aut obcaecati quia id labore omnis ut harum blanditiis eos quia magnam et totam provident. Vel molestiae necessitatibus qui quae sunt ab quibusdam aspernatur qui dolorum facere. Id natus veniam est dolores quia vel veritatis sint aut earum voluptatem. Qui quia doloribus rem dolore recusandae est excepturi dolorum sed doloremque omnis sed facere quod. </p><p>Eos maxime esse non facere eveniet qui incidunt officiis hic unde culpa. Eos quod omnis in natus incidunt et galisum reiciendis ad temporibus eligendi. Ea adipisci quas aut natus blanditiis eos doloremque inventore ut deserunt quia ex reprehenderit magnam nam ullam odio. Et iure accusantium et odit expedita ad voluptatem blanditiis ea placeat facere ut iusto nisi ut sunt omnis nam fuga iste. Ut molestiae illum sit consequuntur"
texto += "voluptates et quod nesciunt sed cupiditate sint. Sed enim laborum hic quidem alias non quam illum eos dolor dolore. Ut error eaque non perferendis galisum est deleniti voluptatem et quibusdam consequatur. </p><p>Et sapiente iure et cumque voluptas non aliquid quas qui dicta voluptas qui dolorem quasi ut voluptas doloremque. Ea totam accusamus et aliquid rerum cum impedit nobis 33 necessitatibus perferendis. Et eveniet velit ea odit molestiae qui vero cumque et explicabo tempore rem fugiat doloremque. Eum iusto blanditiis ab voluptates laborum ut nesciunt sint ut enim eaque ut earum blanditiis aut tempora sapiente! Est eligendi quam ab laboriosam cupiditate At minima quia aut consequatur dolores ut deleniti voluptas ea blanditiis optio. </p><p>Qui qua erat accusamus eum aliquam exercitationem aut optio illo ea blanditiis ducimus sed rerum maxime ut omnis iusto ex minima iste. In quas voluptas vel nesciunt ipsa sed sunt consequatur At praesentium praesentium est dolore corporis qui necessitatibus reprehenderit. Ab voluptatum natus aut veritatis adipisci ut ac cusantium natus ut facere facilis aut temporibus minima et magnam sint? Aut quia quas qui earum nisi sit consequatur rerum qui ipsam vero id omnis quia et molestiae quasi qui dolores laboriosam. Sit impedit quae non consequatur inventore aut illo voluptatem et saepe vero. Et iste quasi cum quae architecto et dolorem necessitatibus quo fuga soluta in asperiores veritatis qui maxime error et laborum dignissimos. Ut natus minima ea necessitatibus fugiat rem plac eat officiis cum praesentium numquam. </p><p>Et quia facere vel esse obcaecati ut officiis perspiciatis et accusantium iusto quo consequatur totam eos par iatur illo 33 inventore maiores. Et enim sint qui architecto officia a Quis nihil in facilis tempore quo sunt quibusdam vel debitis eligendi est mollitia perferendis. Et saepe sint 33 sunt perferendis et quae blanditiis ex placeat itaque sed omnis mollitia sit adipisci expedita. Vel soluta maxime ad ullam v ero et nobis deleniti sed consequatur consequatur et amet iusto ex ullam cumque. Sed unde incidunt et magnam quaerat et quis voluptatem ut tenetur laudant ium eos quibusdam mollitia ea similique reiciendis? Et amet consequatur rem veniam velit a ullam illum. Eum sunt dolore 33 voluptas fugiat eum corporis qu asi ab iste illo sed deleniti odio et autem rerum. </p><p>Vel iure dolorem id corporis alias et modi rerum qui quia consequatur qui quidem rerum aut optio"
texto += "ducimus. Et consequatur assumenda eos cumque dolor eos fugit autem et molestiae molestiae ea ratione inventore est aliquam voluptatem vel itaque eaque. Aut exercitationem doloremque in quis vitae et fugiat Quis hic quas maxime. Non beatae itaque 33 consequatur velit non similique galisum qui maxime voluptatem."
texto += "nesciunt. Est officia obcaecati et assumenda quae vel labore internos et modi sunt quo voluptas quae sed sunt voluptatem? Id assumenda iusto a reiciendis galisum est beatae architecto ad iste nihil qui delectus necessitatibus est nobis voluptatum et sint nulla. Vel expedita veritatis est repellendus atque est quis minus et rerum quas est internos dolores ut provident totam! </p><p>Aut optio omnis id quidem ullam id libero quos sit numquam accusamus At voluptates quam. Qui facere earum aut eaque harum et tenetur molestias et consequatur doloremque aut aspernatur placeat. Eos recusandae quos et distinctio eveniet ut cupiditate quia a quis dolor et omnis dolores! Non aperiam dolor sed quia eius qui atque mollitia et atque commodi et vero laudantium ut minima autem. Nam ullam quasi At nihil nihil sit unde exercitationem At iste veniam ea ratione itaque et veritatis placeat est tempore modi. Aut iure repudiandae quo voluptates dolorum ea aperiam Quis et libero delectus aut rerum obcaecati et voluptas eligendi et consequuntur nemo? At perferendis esse ut cumque nesciunt ab aliquam illum. </p><p>Non commodi placeat ea quasi"

let server;

beforeEach(() => {
    const port = 3000;
    server = app.listen(port);
});

afterEach(() => {
    server.close();
});

describe('POST em /translate', () => {
    it('Deve realizar uma tradução', async () => {
        await request(app)
            .post('/translate')
            .send({
                text: "o rato roeu"
              })
            .expect(200);
    });

    it('Deve realizar uma tradução no formato errado', async () => {
        await request(app)
            .post('/translate')
            .send({
                pig: "o rato roeu"
            })
            .expect(422);
    });

    it('Deve realizar uma tradução com mais de 5000 caracteres', async () => {
        await request(app)
            .post('/translate')
            .send({
                text: texto
            })
            .expect(422)
            .timeout(5000); // Timeout de 5 segundos
    });
});
