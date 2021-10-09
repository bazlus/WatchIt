namespace WatchIt.Domain.Models
{
    using System;
    using System.Collections.Generic;
    using System.Linq;
    using System.Text;
    using System.Threading.Tasks;

    public class Movie
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public IEnumerable<Like> Likes { get; set; }
    }
}
